package cn.pandora.task;

import cn.pandora.auth.Access;
import cn.pandora.auth.CompanyTree;
import cn.pandora.auth.Actor;
import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import cn.pandora.common.Events;
import cn.pandora.common.Writes;
import cn.pandora.workspace.ExpiryService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.sql.Time;
import java.time.*;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.function.Supplier;

import static cn.pandora.common.Db.s;
import static cn.pandora.common.Db.n;

/** Task snapshots and approval commands. Writes.run owns the enclosing transaction/organization lock. */
@Service
public class TaskService {
    /** Snapshot fields in a stable order so the recorded history and the reviewer diff are deterministic. */
    private static final List<String> FORM_FIELDS = List.of("title", "description", "acceptanceCriteria", "priority",
            "allDay", "startAt", "dueAt", "startDate", "dueDate", "assigneeIds", "parentTaskId", "tagId");
    private static final Set<String> FORM = Set.copyOf(FORM_FIELDS);
    /** Reopening may replace inactive assignees while preserving the task's base information. */
    private static final Set<String> REOPEN_FORM = Set.of("allDay", "startAt", "dueAt", "startDate", "dueDate", "assigneeIds");
    private static final Set<String> COMMANDS = Set.of("create", "change", "progress", "complete", "reopen");
    /** Operations a preview may be asked about (chapter 3.3); each uses its own routing rule. */
    private static final Set<String> OPERATIONS = Set.of("create", "change", "progress", "complete", "reopen", "handover");
    private static final Set<String> STATES = Set.of("todo", "doing", "done");
    private static final Set<String> PRIORITIES = Set.of("urgent", "high", "medium", "low");
    private static final Set<String> SCHEDULE_FIELDS = Set.of("allDay", "startAt", "dueAt", "startDate", "dueDate");
    /** Documented default for an organization that has not configured a cut-off. */
    private static final LocalTime DEFAULT_ALL_DAY_CUTOFF = LocalTime.of(18, 0);
    private final Db db;
    private final Access access;
    private final Events events;
    private final Clock clock;
    private final ExpiryService expiry;
    private final CompanyTree companyTree;
    private final Tags tags;
    private final ThreadLocal<ReadBatch> batchReads = new ThreadLocal<>();

    /** Test seam: the real dependencies are derived from the same Db when constructed directly. */
    public TaskService(Db db, Access access, Events events, Clock clock, ExpiryService expiry) {
        this(db, access, events, clock, expiry, new CompanyTree(db), new Tags(db, access, new CompanyTree(db)));
    }

    @org.springframework.beans.factory.annotation.Autowired
    public TaskService(Db db, Access access, Events events, Clock clock, ExpiryService expiry,
                       CompanyTree companyTree, Tags tags) {
        this.db = db;
        this.access = access;
        this.events = events;
        this.clock = clock;
        this.expiry = expiry;
        this.companyTree = companyTree;
        this.tags = tags;
    }

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String, Object> list(Actor actor, Map<String, String> filters) {
        requireBusiness(actor);access.requireCurrent(actor);
        int limit=integer(filters.get("limit"),50,1,100,"limit");
        int offset=integer(filters.get("offset"),0,0,Integer.MAX_VALUE,"offset");
        return access.readScope(actor.organizationId(),()->withReadBatch(loadTaskBatch(actor),()-> {
            List<VisibleTask> visible=filteredTasks(actor,filters);
            int begin=Math.min(offset,visible.size());
            int end=(int)Math.min((long)begin+limit,visible.size());
            Set<String> pinned=pinnedIds(actor);
            List<Map<String,Object>> items=new ArrayList<>();
            for(VisibleTask row:visible.subList(begin,end)) {
                Map<String,Object> view=taskView(actor,row.task(),row.version(),row.owners());
                view.put("pinned",pinned.contains(s(row.task(),"id")));items.add(view);
            }
            Map<String,Object> result=new LinkedHashMap<>();result.put("items",items);
            result.put("total",visible.size());result.put("nextCursor",end<visible.size()?Integer.toString(end):null);
            return result;
        }));
    }

    /** Analytics needs one effective snapshot, not full route projections repeated once per page. */
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public List<Map<String,Object>> statisticsTasks(Actor actor,Map<String,String> filters) {
        requireBusiness(actor);access.requireCurrent(actor);
        return access.readScope(actor.organizationId(),()->withReadBatch(loadTaskBatch(actor),()->
                filteredTasks(actor,filters).stream().map(row->{
                    Map<String,Object> view=new LinkedHashMap<>(row.version());
                    view.put("id",s(row.task(),"id"));view.put("taskId",s(row.task(),"id"));
                    view.put("originalCreatorId",s(row.task(),"originalCreatorId"));
                    view.put("businessOwnerId",access.businessOwner(row.task()));
                    Map<String,Object> pending=currentBatch(actor).pending.get(s(row.task(),"id"));
                    view.put("pending",pending!=null);view.put("frozen",pending!=null);
                    view.put("pendingKind",pending==null?null:s(pending,"kind"));
                    view.put("assigneeIds",row.owners());return view;
                }).toList()));
    }

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Set<String> readableTaskIds(Actor actor,Collection<String> requestedIds) {
        return readableTaskIds(actor,requestedIds,false);
    }

    /** includeApproval is only for ordinary notification links; comments never inherit that access. */
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Set<String> readableTaskIds(Actor actor,Collection<String> requestedIds,boolean includeApproval) {
        if(!actor.business() || requestedIds==null || requestedIds.isEmpty()) return Set.of();
        access.requireCurrent(actor);
        Set<String> ids=new LinkedHashSet<>(requestedIds);ids.remove(null);if(ids.isEmpty()) return Set.of();
        return access.readScope(actor.organizationId(),()-> {
            ReadBatch batch=baseReadBatch(actor);loadTasks(batch,ids);loadCurrentVersions(batch);
            access.primeBusinessOwners(actor.organizationId(),batch.tasks.keySet());
            return withReadBatch(batch,()-> {
                Set<String> visible=new LinkedHashSet<>();
                for(var task:batch.tasks.values()) {
                    String current=s(task,"currentVersionId");
                    if(current!=null && access.canSeeTask(actor,task,version(actor,current),assignees(actor,current)))
                        visible.add(s(task,"id"));
                }
                if(includeApproval) {
                    for(List<String> part:chunks(new ArrayList<>(ids))) {
                        List<Object> args=new ArrayList<>();args.add(actor.organizationId());args.addAll(part);
                        args.add(actor.id());args.add(actor.id());
                        for(var request:db.list("SELECT * FROM approval_requests WHERE organization_id=? AND task_id IN ("+marks(part.size())
                                +") AND (applicant_id=? OR current_reviewer_id=? OR status='pending')",args.toArray())) {
                            var task=batch.tasks.get(s(request,"taskId"));
                            if(task!=null && !visible.contains(s(task,"id"))) {
                                // Match canReadRequest's non-authoritative probe: one broken route must not fail an inbox.
                                try {if(canSeeRequest(actor,request,task)) visible.add(s(task,"id"));}
                                catch(RuntimeException ignored) { /* unavailable request grants no historical access */ }
                            }
                        }
                    }
                }
                return visible;
            });
        });
    }

    private List<VisibleTask> filteredTasks(Actor actor,Map<String,String> filters) {
        String state=filters.get("state"),priority=filters.get("priority");
        if(state!=null && !STATES.contains(state)) throw bad("无效的任务状态");
        if(priority!=null && !PRIORITIES.contains(priority)) throw bad("无效的紧急程度");
        String assignee=optionalId(filters.get("assigneeId"),"assigneeId"),creator=optionalId(filters.get("creatorId"),"creatorId");
        String query=filters.getOrDefault("q","").trim();if(query.length()>200) throw bad("搜索内容最多200字");
        LocalDate from=optionalDate(filters.get("from"),"from"),to=optionalDate(filters.get("to"),"to");
        if(from!=null && to!=null && to.isBefore(from)) throw bad("结束日期不得早于开始日期");
        ZoneId zone=organizationZone(actor);List<VisibleTask> visible=new ArrayList<>();
        for(var task:currentBatch(actor).tasks.values()) {
            Map<String,Object> version=version(actor,s(task,"currentVersionId"));
            List<String> owners=assignees(actor,s(version,"id"));
            if(!access.canSeeTask(actor,task,version,owners)) continue;
            if(state!=null && !state.equals(s(task,"executionState"))) continue;
            if(priority!=null && !priority.equals(s(version,"priority"))) continue;
            if(assignee!=null && !owners.contains(assignee)) continue;
            if(creator!=null && !creator.equals(s(task,"originalCreatorId"))) continue;
            if(!query.isEmpty() && !s(version,"title").toLowerCase(Locale.ROOT).contains(query.toLowerCase(Locale.ROOT))) continue;
            LocalDate start=instant(version.get("startAt"),"startAt").atZone(zone).toLocalDate();
            LocalDate due=instant(version.get("dueAt"),"dueAt").atZone(zone).toLocalDate();
            if(from!=null && due.isBefore(from) || to!=null && start.isAfter(to)) continue;
            visible.add(new VisibleTask(task,version,owners));
        }
        return visible;
    }
    private record VisibleTask(Map<String,Object> task,Map<String,Object> version,List<String> owners) {}

    /**
     * Administration task locator (chapter 9.1): a paginated, company-wide minimum projection used by
     * the formal PC console to find a task before opening its operation history.
     *
     * <p>It is authorized by the task-history capability and deliberately does not call the employee
     * visible-list path, so it neither borrows nor widens employee viewing authority. The projection
     * carries display fields only: no phone number, e-mail, password or other contact/credential field.
     */
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String, Object> adminTasks(Actor actor, Map<String, String> filters) {
        access.requireCapability(actor, "view_task_history");access.requireCurrent(actor);
        return access.readScope(actor.organizationId(),()->withReadBatch(loadAdminBatch(actor),()->adminTasksRead(actor,filters)));
    }

    private Map<String,Object> adminTasksRead(Actor actor,Map<String,String> filters) {
        int limit = integer(filters.get("limit"), 50, 1, 100, "limit");
        int offset = integer(filters.get("offset"), 0, 0, Integer.MAX_VALUE, "offset");
        String state = filters.get("state");
        if (state != null && !state.isBlank() && !STATES.contains(state)) throw bad("无效的任务状态");
        if (state != null && state.isBlank()) state = null;
        String creator = optionalId(filters.get("creatorId"), "creatorId");
        String assignee = optionalId(filters.get("assigneeId"), "assigneeId");
        String requestStatus = filters.get("requestStatus");
        String query = filters.getOrDefault("q", "").trim();
        if (query.length() > 200) throw bad("搜索内容最多200字");
        LocalDate from = optionalDate(filters.get("from"), "from");
        LocalDate to = optionalDate(filters.get("to"), "to");
        if (from != null && to != null && to.isBefore(from)) throw bad("结束日期不得早于开始日期");
        ZoneId zone = organizationZone(actor);
        Map<String, String> names = userNameMap(actor);
        Map<String,Map<String,Object>> latestRequests=currentBatch(actor).latestRequests;
        List<Map<String, Object>> visible = new ArrayList<>();
        for (Map<String,Object> task:currentBatch(actor).tasks.values()) {
            String taskId = s(task, "id");
            String current = s(task, "currentVersionId");
            Map<String, Object> request = latestRequests.get(taskId);
            Map<String, Object> version = current != null ? version(actor, current)
                    : request == null ? null : version(actor, s(request, "proposedVersionId"));
            if (version == null) continue;
            String latestStatus = request == null ? null : s(request, "status");
            if (requestStatus != null && !requestStatus.equals(latestStatus)) continue;
            if (state != null && !state.equals(s(task, "executionState"))) continue;
            if (creator != null && !creator.equals(s(task, "originalCreatorId"))) continue;
            List<String> owners = current != null ? assignees(actor, current) : assignees(actor, s(version, "id"));
            if (assignee != null && !owners.contains(assignee)) continue;
            String title = s(version, "title");
            if (!query.isEmpty() && (title == null || !title.toLowerCase(Locale.ROOT).contains(query.toLowerCase(Locale.ROOT)))) continue;
            if (from != null || to != null) {
                LocalDate start = scheduleDate(version, "start", zone), due = scheduleDate(version, "due", zone);
                if (start == null || due == null) continue;
                if (from != null && due.isBefore(from) || to != null && start.isAfter(to)) continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("taskId", taskId);
            row.put("id", taskId);
            row.put("title", title);
            row.put("published", current != null);
            row.put("currentVersionId", current);
            row.put("executionState", s(task, "executionState"));
            for (String key : List.of("priority", "allDay", "startAt", "dueAt", "startDate", "dueDate")) row.put(key, version.get(key));
            row.put("ownerIds", owners);
            row.put("ownerNames", owners.stream().map(id -> names.getOrDefault(id, id)).toList());
            row.put("creatorId", s(task, "originalCreatorId"));
            row.put("creatorName", names.getOrDefault(s(task, "originalCreatorId"), s(task, "originalCreatorId")));
            for (String key : List.of("createdAt", "updatedAt", "rowVersion")) row.put(key, task.get(key));
            row.put("latestRequestId", request == null ? null : s(request, "id"));
            row.put("latestRequestStatus", latestStatus);
            row.put("pendingRequestId", "pending".equals(latestStatus) ? s(request, "id") : null);
            row.put("pendingKind", "pending".equals(latestStatus) ? s(request, "kind") : null);
            visible.add(row);
        }
        int begin = Math.min(offset, visible.size());
        int end = (int) Math.min((long) begin + limit, visible.size());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", visible.subList(begin, end));
        result.put("total", visible.size());
        result.put("nextOffset", end < visible.size() ? end : null);
        return result;
    }

    /** Display names for one company, used only to label administrator history/task projections. */
    private Map<String, String> userNameMap(Actor actor) {
        Map<String, String> names = new LinkedHashMap<>();
        for (Map<String, Object> row : db.list("SELECT id,display_name FROM users WHERE organization_id=?", actor.organizationId())) {
            names.put(s(row, "id"), s(row, "displayName"));
        }
        return names;
    }

    /** One schedule boundary as a business date in the company zone, or null when absent. */
    private static LocalDate scheduleDate(Map<String, Object> version, String boundary, ZoneId zone) {
        String exact = s(version, boundary + "At");
        if (exact != null) return instant(version.get(boundary + "At"), boundary + "At").atZone(zone).toLocalDate();
        Object value = version.get(boundary + "Date");
        return value == null ? null : LocalDate.parse(String.valueOf(value));
    }

    /**
     * Assignee candidates for the task form.
     *
     * {@code purpose=create} (the default, and what the creation form asks for) is the whole company's
     * active business staff, including other departments, direct managers and the founder. This is a
     * candidate/person list only: it does not grant viewing, log, handover or administrator authority,
     * and the submit/approve checks re-run the same rule.
     *
     * {@code purpose=edit} keeps the historical dispatch range for modifications of a published task,
     * so this change never widens non-creation dispatch authority.
     */
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String, Object> assigneeCandidates(Actor actor, String query) {
        return assigneeCandidates(actor, query, "create");
    }

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String, Object> assigneeCandidates(Actor actor, String query, String purpose) {
        requireBusiness(actor);access.requireCurrent(actor);
        if (query != null && query.length() > 100) throw bad("搜索内容最多100字");
        String resolved = purpose == null || purpose.isBlank() ? "create" : purpose;
        if (!Set.of("create", "edit").contains(resolved)) throw bad("purpose须为create或edit");
        List<Map<String, Object>> people = "edit".equals(resolved)
                ? access.dispatchCandidates(actor, query)
                : access.creationCandidates(actor, query);
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> person : people) {
            Map<String, Object> item = new LinkedHashMap<>();
            for (String key : List.of("id", "displayName", "departmentId", "departmentName",
                    "positionId", "positionName", "teamId", "rankLevel")) {
                item.put(key, person.get(key));
            }
            items.add(item);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("empty", items.isEmpty());
        result.put("purpose", resolved);
        return result;
    }

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String, Object> detail(Actor actor, String id) {
        requireBusiness(actor);access.requireCurrent(actor);
        Map<String, Object> task = task(actor, id, false);
        String current = s(task, "currentVersionId");
        if (current == null) {
            Map<String, Object> request = db.find("SELECT * FROM approval_requests WHERE organization_id=? AND task_id=? ORDER BY created_at DESC,id DESC LIMIT 1", actor.organizationId(), id);
            if (request == null || !canSeeRequest(actor, request, task)) throw ApiException.notFound();
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id", id);
            result.put("taskId", id);
            result.put("rowVersion", n(task, "rowVersion"));
            result.put("currentVersionId", null);
            result.put("published", false);
            result.put("pending", "pending".equals(s(request, "status")));
            result.put("frozen", "pending".equals(s(request, "status")));
            result.put("pendingRequestId", "pending".equals(s(request, "status")) ? s(request, "id") : null);
            result.put("latestRequestId", s(request, "id"));
            Map<String, Object> proposed = version(actor, s(request, "proposedVersionId"));
            result.put("proposedVersion", snapshotView(actor, proposed));
            result.put("originalCreatorId", s(task, "originalCreatorId"));
        result.put("businessOwnerId",access.businessOwner(task));
            // An unpublished task has no effective route yet; the applicant sees the request's route.
            result.put("route", new LinkedHashMap<String, Object>());
            result.put("proposedRoute", routeView(actor, storedRoute(actor, request)));
            result.put("reviewerId", reviewerOfRecord(request));
            Set<String> participantIds = new LinkedHashSet<>(assignees(actor, s(proposed, "id")));
            participantIds.add(s(task, "originalCreatorId"));
            participantIds.add(s(request, "applicantId"));
            participantIds.add(s(proposed, "createdBy"));
            participantIds.add(s(result, "reviewerId"));
            result.put("participants", participantSummaries(actor, participantIds));
            result.put("canHandover", false);
            result.put("handoverSources", List.of());
            result.put("handoverPresets", Map.of());
            return result;
        }
        Map<String, Object> version = version(actor, current);
        List<String> owners = assignees(actor, current);
        if (!access.canSeeTask(actor, task, version, owners)) throw ApiException.notFound();
        Map<String, Object> result = taskView(actor, task, version, owners);
        result.put("pinned", isPinned(actor, id));
        // The effective route and, for whoever may see it, this request's own route (DEV-010).
        Map<String, Object> pendingRequest = pending(actor, id, false);
        result.put("pendingRoute", pendingRequest != null && canSeeRequest(actor, pendingRequest, task)
                ? routeView(actor, storedRoute(actor, pendingRequest)) : new LinkedHashMap<String, Object>());
        List<String> handoverSources = pendingRequest == null
                ? owners.stream().filter(owner -> access.canHandover(actor, owner, owners)).toList()
                : List.of();
        Map<String, Object> handoverPresets = new LinkedHashMap<>();
        for (String source : handoverSources) {
            String preset = presetTarget(actor, source);
            if (preset != null) handoverPresets.put(source, preset);
        }
        result.put("canHandover", !handoverSources.isEmpty());
        result.put("handoverSources", handoverSources);
        result.put("handoverPresets", handoverPresets);
        result.put("records", db.list("SELECT id,author_id,body,kind,effective_at,created_at FROM task_records WHERE organization_id=? AND task_id=? AND effective_at IS NOT NULL ORDER BY created_at,id", actor.organizationId(), id));
        List<Map<String, Object>> children = new ArrayList<>();
        for (Map<String, Object> child : db.list("SELECT t.* FROM tasks t JOIN task_versions v ON v.organization_id=t.organization_id AND v.id=t.current_version_id WHERE t.organization_id=? AND v.parent_task_id=? ORDER BY t.created_at,t.id", actor.organizationId(), id)) {
            Map<String, Object> childVersion = version(actor, s(child, "currentVersionId"));
            if (access.canSeeTask(actor, child, childVersion, assignees(actor, s(childVersion, "id")))) {
                children.add(Map.of("id", s(child, "id"), "title", s(childVersion, "title"), "executionState", s(child, "executionState")));
            }
        }
        result.put("children", children);
        return result;
    }

    public Map<String, Object> create(Actor actor, Map<String, Object> input) {
        requireBusiness(actor);
        allowed(input, FORM);
        rejectCreationCriteria(input);
        Map<String, Object> proposed = validateForm(actor, input, null);
        proposed.put("acceptanceCriteria", "");
        List<String> owners = ids(proposed.get("assigneeIds"));
        validateCreationAssignable(actor, owners);
        String id = Db.id();
        validateParent(actor, id, s(proposed, "parentTaskId"), true);
        Route route = creationRoute(actor, actor.id());
        if (route.blocked()) throw conflict("ROUTE_BLOCKED", route.reasonText());
        Timestamp now = now();
        db.update("INSERT INTO tasks(id,organization_id,original_creator_id,current_version_id,execution_state,row_version,execution_round,due_version,created_at,updated_at) VALUES(?,?,?,NULL,'todo',1,1,1,?,?)", id, actor.organizationId(), actor.id(), now, now);
        db.update("INSERT INTO task_business_owners(organization_id,task_id,employee_id) VALUES(?,?,?)",actor.organizationId(),id,actor.id());
        Map<String, Object> task = task(actor, id, true);
        proposed.put("executionState", "todo");
        proposed.put("progressNote", "");
        return submit(actor, task, null, proposed, owners, route, "create", null);
    }

    /**
     * Committed deadline handling before a submission transaction. The controller calls this before
     * {@code Writes.run}: if the page it is about to submit is stale, the 4xx response must not roll
     * back the expiry/unfreeze terminal state (design §6, DEV-012).
     */
    public void expireBeforeSubmit(Actor actor, String taskId) {
        expiry.expirePendingBeforeSubmit(actor.organizationId(), taskId);
    }

    public Map<String, Object> change(Actor actor, String id, String ifMatch, Map<String, Object> input) {
        requireBusiness(actor);
        String command = command(input, "command", "action", "change");
        if (!Set.of("create", "change", "progress", "complete", "reopen").contains(command)) throw bad("不支持的任务动作");
        Map<String, Object> task = task(actor, id, true);
        String currentId = s(task, "currentVersionId");
        Map<String, Object> current = currentId == null ? null : version(actor, currentId);
        List<String> currentOwners = current == null ? List.of() : assignees(actor, currentId);
        boolean creator = actor.id().equals(s(task, "originalCreatorId"));
        boolean responsible=actor.id().equals(access.businessOwner(task));
        if (current == null ? !creator : !access.canSeeTask(actor, task, current, currentOwners)) throw ApiException.notFound();
        Writes.checkVersion(ifMatch, n(task, "rowVersion"));
        if (pending(actor, id, true) != null) throw conflict("TASK_FROZEN", "任务有待审核申请，请先处理或撤销");
        Map<String, Object> proposed;
        List<String> proposedOwners;
        String body = null;
        if (current == null) {
            if (!creator || !Set.of("create", "change").contains(command)) throw forbidden("未发布任务仅创建者可编辑重提");
            allowed(input, union(FORM, "command", "action", "reason"));
            rejectCreationCriteria(input);
            Map<String, Object> previous = db.one("SELECT * FROM task_versions WHERE organization_id=? AND task_id=? ORDER BY version_no DESC LIMIT 1", actor.organizationId(), id);
            previous = new LinkedHashMap<>(previous);
            previous.put("assigneeIds", assignees(actor, s(previous, "id")));
            proposed = validateForm(actor, input, previous);
            // A creation resubmission is a new creation request: it starts with an empty criterion and
            // never inherits the obsolete proposal's text as a required field.
            proposed.put("acceptanceCriteria", "");
            proposed.put("executionState", "todo");
            proposed.put("progressNote", "");
            command = "create";
            if (input.containsKey("reason")) body = requiredText(input, "reason", 500);
        } else if ("change".equals(command)) {
            if (!responsible) throw forbidden("仅当前业务责任方可修改任务资料");
            if ("done".equals(s(task, "executionState"))) throw conflict("TASK_COMPLETED", "已完成任务须先重开");
            allowed(input, union(FORM, "command", "action", "reason"));
            body = requiredText(input, "reason", 500);
            if (FORM.stream().noneMatch(input::containsKey)) throw bad("请提供需要修改的任务字段");
            Map<String, Object> base = new LinkedHashMap<>(current);
            base.put("assigneeIds", currentOwners);
            proposed = validateForm(actor, input, base);
            // A non-schedule edit keeps the effective schedule and its cut-off snapshot exactly as
            // submitted; only an actual schedule revision adopts the current company setting (DEV-015).
            if (!hasScheduleInput(input)) {
                for (String field : List.of("allDay", "startAt", "dueAt", "startDate", "dueDate", "allDayCutoffTime")) {
                    proposed.put(field, current.get(field));
                }
            }
            proposed.put("executionState", s(current, "executionState"));
            proposed.put("progressNote", current.get("progressNote"));
        } else {
            if ("create".equals(command)) throw bad("已发布任务不可再次创建");
            proposed = new LinkedHashMap<>(current);
            proposed.put("assigneeIds", currentOwners);
            if ("reopen".equals(command)) {
                // A complete schedule is required; omitted assignees retain the existing ordered list.
                allowed(input, union(REOPEN_FORM, "command", "action", "reason"));
                if (!responsible) throw forbidden("仅当前业务责任方可重开任务");
                requireReopenSchedule(input);
                if (!"done".equals(s(task, "executionState"))) throw conflict("INVALID_TASK_STATE", "仅已完成任务可重开");
                body = requiredText(input, "reason", 500);
                Map<String, Object> base = new LinkedHashMap<>(current);
                base.put("assigneeIds", currentOwners);
                proposed = validateForm(actor, input, base);
                // validateForm only carries the FORM fields, so the note is restored explicitly.
                proposed.put("progressNote", current.get("progressNote"));
                proposed.put("executionState", "doing");
            } else {
                if (!currentOwners.contains(actor.id())) throw forbidden("仅当前负责人可更新进展或提交完成");
                if ("done".equals(s(task, "executionState"))) throw conflict("TASK_COMPLETED", "已完成任务须先重开");
                if ("progress".equals(command)) {
                    allowed(input, Set.of("command", "action", "progressNote"));
                    body = requiredText(input, "progressNote", 2000);
                    proposed.put("progressNote", body);
                    proposed.put("executionState", "doing");
                } else {
                    allowed(input, Set.of("command", "action", "completionNote"));
                    body = requiredText(input, "completionNote", 2000);
                    proposed.put("executionState", "done");
                }
            }
        }
        proposedOwners = ids(proposed.get("assigneeIds"));
        if (current == null) validateCreationAssignable(actor, proposedOwners);
        else if ("change".equals(command)) validateAssignable(actor, proposedOwners);
        else validateActiveOwners(actor, proposedOwners);
        validateParent(actor, id, s(proposed, "parentTaskId"), current == null || !Objects.equals(s(current, "parentTaskId"), s(proposed, "parentTaskId")));
        // A creation and a creation resubmission route by the creator's own place in the organization,
        // never by the assignees, so reordering owners cannot change the creation reviewer (chapter 3.2).
        // Every other operation routes solely to the current business owner.
        Route route = current == null ? creationRoute(actor, s(task, "originalCreatorId"))
                : route(actor, proposedOwners, access.businessOwner(task));
        if (route.blocked()) throw conflict("ROUTE_BLOCKED", route.reasonText());
        return submit(actor, task, current, proposed, proposedOwners, route, command, body);
    }

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String, Object> approvals(Actor actor, String mine) {
        return approvals(actor, mine, null, null);
    }

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String, Object> approvals(Actor actor, String mine, String requestedLimit, String requestedOffset) {
        requireBusiness(actor);access.requireCurrent(actor);
        int limit = integer(requestedLimit, 50, 1, 100, "limit");
        int offset = integer(requestedOffset, 0, 0, Integer.MAX_VALUE, "offset");
        if (mine == null || mine.isBlank()) mine = "all";
        if ("submitted".equals(mine)) mine = "applicant";
        if ("reviewing".equals(mine)) mine = "reviewer";
        if (!Set.of("all", "reviewer", "applicant").contains(mine)) throw bad("mine须为all、reviewer或applicant");
        String selectedMine=mine;
        return access.readScope(actor.organizationId(),()-> {
            // A pending review is routed from the current organization/business owner, never its stale stored reviewer.
            List<Map<String,Object>> candidates=db.list("SELECT * FROM approval_requests WHERE organization_id=? "
                    +"AND (applicant_id=? OR current_reviewer_id=? OR status='pending') ORDER BY created_at DESC,id",
                    actor.organizationId(),actor.id(),actor.id());
            ReadBatch batch=baseReadBatch(actor);
            Set<String> taskIds=new LinkedHashSet<>();candidates.forEach(row->taskIds.add(s(row,"taskId")));
            loadTasks(batch,taskIds);loadCurrentVersions(batch);access.primeBusinessOwners(actor.organizationId(),batch.tasks.keySet());
            return withReadBatch(batch,()-> {
                List<Map<String,Object>> visible=new ArrayList<>();
                for(var request:candidates) {
                    var task=task(actor,s(request,"taskId"),false);
                    if(!canSeeRequest(actor,request,task)) continue;
                    boolean applicant=actor.id().equals(s(request,"applicantId"));String reviewer=requestReviewer(actor,request,task);
                    if("applicant".equals(selectedMine) && !applicant || "reviewer".equals(selectedMine) && !actor.id().equals(reviewer)) continue;
                    visible.add(request);
                }
                int begin=Math.min(offset,visible.size()),end=(int)Math.min((long)begin+limit,visible.size());
                List<Map<String,Object>> pageRequests=visible.subList(begin,end);Set<String> versions=new LinkedHashSet<>();
                for(var request:pageRequests) {versions.add(s(request,"proposedVersionId"));versions.add(s(request,"baseVersionId"));}
                loadVersions(batch,versions);
                List<Map<String,Object>> items=new ArrayList<>();
                for(var request:pageRequests) items.add(requestView(actor,request,task(actor,s(request,"taskId"),false),false));
                Map<String,Object> page=new LinkedHashMap<>();page.put("items",items);page.put("total",visible.size());
                page.put("nextCursor",end<visible.size()?Integer.toString(end):null);return page;
            });
        });
    }

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String, Object> approval(Actor actor, String id) {
        requireBusiness(actor);access.requireCurrent(actor);
        Map<String, Object> request = request(actor, id, false);
        Map<String, Object> task = task(actor, s(request, "taskId"), false);
        if (!canSeeRequest(actor, request, task)) throw ApiException.notFound();
        // Only the reviewer of record gets the comparison snapshot and the per-field diff (DEV-011).
        boolean reviewer = actor.id().equals(requestReviewer(actor,request,task));
        Map<String, Object> result = requestView(actor, request, task, reviewer);
        result.put("records", db.list("SELECT id,author_id,body,kind,effective_at,created_at FROM task_records WHERE organization_id=? AND request_id=? ORDER BY created_at,id", actor.organizationId(), id));
        return result;
    }

    /**
     * Non-authoritative visibility probe for the notification worker. It deliberately avoids the
     * {@link #approval(Actor, String)} read projection: that method is transactional through the
     * Spring proxy, so a legitimate 404 for an unrelated request would mark the enclosing delivery
     * transaction rollback-only even though the caller catches the exception. This probe performs
     * only reads and treats a broken/blocked route as "not visible".
     */
    public boolean canReadRequest(Actor actor, String requestId) {
        if (requestId == null || requestId.isBlank()) return false;
        Map<String, Object> request = db.find("SELECT * FROM approval_requests WHERE organization_id=? AND id=?", actor.organizationId(), requestId);
        if (request == null) return false;
        Map<String, Object> task = db.find("SELECT * FROM tasks WHERE organization_id=? AND id=?", actor.organizationId(), s(request, "taskId"));
        if (task == null) return false;
        try {
            return canSeeRequest(actor, request, task);
        } catch (RuntimeException brokenRoute) {
            return false;
        }
    }

    /**
     * Request projection with the comparison data trimmed per audience (DEV-011).
     *
     * The applicant sees what they submitted and the result. Only the reviewer of record additionally
     * receives the base snapshot and the field diff, so no field lets the applicant or an ordinary viewer
     * reconstruct the previous effective values of a pending proposal.
     */
    private Map<String, Object> requestView(Actor actor, Map<String, Object> request, Map<String, Object> task, boolean includeComparison) {
        Map<String, Object> proposed = version(actor, s(request, "proposedVersionId"));
        Map<String, Object> base = s(request, "baseVersionId") == null ? null : version(actor, s(request, "baseVersionId"));
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("requestId", s(request, "id"));
        view.put("taskId", s(request, "taskId"));
        view.put("kind", s(request, "kind"));
        view.put("status", s(request, "status"));
        view.put("comment", request.get("comment"));
        view.put("applicantId", s(request, "applicantId"));
        view.put("currentReviewerId", requestReviewer(actor,request,task));
        view.put("rowVersion", n(request, "rowVersion"));
        view.put("previousState", request.get("previousState"));
        view.put("exemptionReason", request.get("exemptionReason"));
        view.put("createdAt", request.get("createdAt"));
        view.put("decidedAt", request.get("decidedAt"));
        view.put("applicableDeadline", request.get("applicableDeadline"));
        view.put("expiredAt", request.get("expiredAt"));
        view.put("title", s(proposed, "title"));
        view.put("versionNo", proposed.get("versionNo"));
        view.put("route", routeView(actor, "pending".equals(s(request,"status"))?currentRoute(actor,task,request):storedRoute(actor, request)));
        view.put("proposedVersion", snapshotView(actor, proposed));
        if (includeComparison) {
            view.put("baseVersionId", s(request, "baseVersionId"));
            view.put("baseVersion", base == null ? null : snapshotView(actor, base));
            view.put("diff", diff(actor, base, proposed));
        }
        Set<String> participantIds = new LinkedHashSet<>(assignees(actor, s(proposed, "id")));
        if (includeComparison && base != null) {
            participantIds.addAll(assignees(actor, s(base, "id")));
            participantIds.add(s(base, "createdBy"));
        }
        participantIds.add(s(proposed, "createdBy"));
        participantIds.add(s(task, "originalCreatorId"));
        participantIds.add(s(request, "applicantId"));
        participantIds.add(reviewerOfRecord(request));
        view.put("participants", participantSummaries(actor, participantIds));
        return view;
    }

    /** Field-by-field difference between the effective snapshot and the proposal, for the reviewer only. */
    private List<Map<String, Object>> diff(Actor actor, Map<String, Object> base, Map<String, Object> proposed) {
        List<Map<String, Object>> changes = new ArrayList<>();
        if (base == null) return changes;
        for (String field : FORM_FIELDS) {
            if ("assigneeIds".equals(field)) continue;
            String before = tagAware(base, field);
            String after = tagAware(proposed, field);
            if (!Objects.equals(before, after)) {
                changes.add(Map.of("field", field, "before", Objects.toString(before, ""), "after", Objects.toString(after, "")));
            }
        }
        List<String> beforeOrder = assignees(actor, s(base, "id"));
        List<String> afterOrder = assignees(actor, s(proposed, "id"));
        if (!beforeOrder.equals(afterOrder)) {
            changes.add(Map.of("field", "assigneeIds", "before", String.join(",", beforeOrder), "after", String.join(",", afterOrder)));
        }
        return changes;
    }

    public Map<String, Object> decide(Actor actor, String id, String ifMatch, Map<String, Object> input) {
        requireBusiness(actor);
        allowed(input, Set.of("decision", "action", "comment"));
        String decision = command(input, "decision", "action", null);
        if (!Set.of("approve", "reject", "withdraw").contains(decision == null ? "" : decision)) throw bad("decision须为approve、reject或withdraw");
        String comment = "reject".equals(decision) ? requiredText(input, "comment", 2000) : optionalText(input, "comment", 2000);
        Map<String, Object> initial = request(actor, id, false);
        Map<String, Object> task = task(actor, s(initial, "taskId"), true);
        Map<String, Object> request = request(actor, id, true); // Always task first, request second.
        if (!canSeeRequest(actor, request, task)) throw ApiException.notFound();
        Writes.checkVersion(ifMatch, n(request, "rowVersion"));
        Instant decidedAt = clock.instant();
        if ("pending".equals(s(request, "status")) && request.get("applicableDeadline") != null
                && !decidedAt.isBefore(ExpiryService.instant(request.get("applicableDeadline")))) {
            // The expiry terminal state is written in this transaction and is returned to the caller
            // as a business error only after this transaction commits (controller boundary), so the
            // unfreeze/expiry event can never be rolled back to make the old page succeed (DEV-012).
            expiry.expire(actor.organizationId(), request, decidedAt, "decide_after_deadline");
            Map<String, Object> expired = result(s(task, "id"), id, "expired", n(task(actor, s(task, "id"), false), "rowVersion"));
            expired.put("status", "expired");
            expired.put("requestStatus", "expired");
            expired.put("deadlineExpired", true);
            expired.put("message", "申请已到适用截止时间失效，请调整后重提");
            return expired;
        }
        if (!"pending".equals(s(request, "status"))) throw conflict("REQUEST_RESOLVED", "该申请已处理，请刷新");
        String reviewer = requestReviewer(actor, request, task);
        if ("withdraw".equals(decision)) {
            if (!actor.id().equals(s(request, "applicantId"))) throw forbidden("仅申请人可撤销申请");
        } else {
            Route current=currentRoute(actor,task,request);
            if(current.blocked()) throw conflict("ROUTE_BLOCKED",current.reasonText());
            if(current.directFor(s(request,"applicantId"))) {
                if(!applyWithoutReviewer(actor,task,request,current))
                    throw conflict("ROUTE_BLOCKED","申请已不满足直接生效条件，请重新读取处理");
                var applied=result(s(task,"id"),id,"direct",n(task(actor,s(task,"id"),false),"rowVersion"));
                applied.put("status","direct");applied.put("requestStatus","direct");
                applied.put("exemptionReason",current.reasonText());return applied;
            }
            if(!Objects.equals(current.reviewerId(),reviewerOfRecord(request)))
                reassignReviewer(actor,task,request,current);
            reviewer=current.reviewerId();
            if (reviewer == null) throw conflict("ROUTE_BLOCKED", "无可用审核人，请联系管理员处理组织关系");
            if (!actor.id().equals(reviewer)) throw forbidden("仅当前指定审核人可处理申请");
        }
        String taskId = s(task, "id");
        String baseId = s(request, "baseVersionId");
        if (!Objects.equals(baseId, s(task, "currentVersionId"))) throw conflict("STALE_BASE_VERSION", "任务有效版本已变化，请重新提交");
        Map<String, Object> proposed = version(actor, s(request, "proposedVersionId"));
        Map<String, Object> base = baseId == null ? null : version(actor, baseId);
        List<String> newOwners = assignees(actor, s(proposed, "id"));
        String kind = s(request, "kind");
        String status = switch (decision) { case "approve" -> "approved"; case "reject" -> "rejected"; default -> "withdrawn"; };
        Timestamp now = now();
        if ("approve".equals(decision)) {
            validateApplicationEffect(actor, task, request, proposed, base, kind);
        }
        int changed = db.update("UPDATE approval_requests SET status=?,comment=?,current_reviewer_id=?,decided_at=?,decided_by=?,row_version=row_version+1 WHERE organization_id=? AND id=? AND status='pending' AND row_version=?", status, comment, reviewer, now, actor.id(), actor.organizationId(), id, n(request, "rowVersion"));
        if (changed != 1) throw conflict("REQUEST_RESOLVED", "该申请已处理，请刷新");
        db.update("UPDATE task_versions SET status=? WHERE organization_id=? AND id=? AND status='proposed'", "approve".equals(decision) ? "applied" : status, actor.organizationId(), s(proposed, "id"));
        if ("approve".equals(decision)) {
            applyVersion(actor, task, base, proposed, kind, "approval");
            db.update("UPDATE task_records SET effective_at=? WHERE organization_id=? AND request_id=?", now, actor.organizationId(), id);
            recordHistory(actor, taskId, id, "version_applied", "versionId", base == null ? null : s(base, "id"), s(proposed, "id"),
                    Map.of("kind", kind, "executionRound", n(task(actor, taskId, false), "executionRound"), "executionState", Objects.toString(s(proposed, "executionState"), "")));
            if ("reopen".equals(kind)) {
                recordHistory(actor, taskId, id, "reopen", "executionRound", Long.toString(n(task, "executionRound")),
                        Long.toString(n(task, "executionRound") + 1), Map.of("reason", Objects.toString(comment, "")));
            }
            if ("handover".equals(kind)) {
                Map<String, Object> handover = db.find("SELECT * FROM handover_requests WHERE organization_id=? AND request_id=?", actor.organizationId(), id);
                if (handover != null) {
                    Map<String, Object> detail = new LinkedHashMap<>();
                    detail.put("sourceUserId", s(handover, "sourceUserId"));
                    detail.put("targetUserId", s(handover, "targetUserId"));
                    detail.put("setByUserId", s(handover, "setByUserId"));
                    recordHistory(actor, taskId, id, "handover", "assigneeIds", s(handover, "sourceUserId"), s(handover, "targetUserId"), detail);
                }
            }
        } else if ("reject".equals(decision) && "complete".equals(kind)) {
            // A completion rejection always leaves an effective doing snapshot, even when completion began at todo.
            Map<String, Object> returned = new LinkedHashMap<>(Objects.requireNonNull(base));
            returned.put("executionState", "doing");
            String newVersion = insertVersion(actor, taskId, returned, assignees(actor, baseId), "applied");
            returned.put("id", newVersion);
            applyVersion(actor, task, base, returned, "return", "approval");
            insertRecord(actor, taskId, id, comment, "return", true);
            recordHistory(actor, taskId, id, "completion_returned", "executionState", "done", "doing",
                    Map.of("comment", Objects.toString(comment, ""), "versionId", newVersion));
        } else {
            db.update("UPDATE tasks SET row_version=row_version+1,updated_at=? WHERE organization_id=? AND id=?", now, actor.organizationId(), taskId);
        }
        Map<String, Object> decided = new LinkedHashMap<>();
        decided.put("kind", kind);
        decided.put("status", status);
        decided.put("decision", decision);
        decided.put("comment", Objects.toString(comment, ""));
        recordHistory(actor, taskId, id, "request_decided", "status", "pending", status, decided);
        Set<String> recipients = recipients(task, base, proposed, s(request, "applicantId"), reviewer, "create".equals(kind) && !"approve".equals(decision), "approve".equals(decision));
        List<String> baseOwners = base == null ? List.of() : assignees(actor, s(base, "id"));
        List<String> removedOwners = new ArrayList<>(baseOwners);
        removedOwners.removeAll(newOwners);
        Map<String, Object> eventDetails = new LinkedHashMap<>();
        eventDetails.put("requestId", id);
        eventDetails.put("kind", kind);
        eventDetails.put("status", status);
        if (!removedOwners.isEmpty()) eventDetails.put("removedUserIds", removedOwners);
        events.record(actor, taskId, "task." + kind + "." + status, recipients, eventDetails,
                id, s(proposed, "id"), s(proposed, "title"), eventSummary(actor, kind, status, base, proposed));
        Map<String, Object> updated = task(actor, taskId, false);
        Map<String, Object> result = result(taskId, id, status, n(updated, "rowVersion"));
        result.put("requestRowVersion", n(request, "rowVersion") + 1);
        return result;
    }

    /**
     * Read-only reviewer preview for one operation (DEV-008, DEV-010; chapters 3.2-3.3).
     *
     * A creation (or creation resubmission) is previewed with the creator's own rule: the unique
     * fixed founder is exempt with a recorded reason, anyone
     * else routes to their direct manager, and an unusable relationship is reported as blocked instead
     * of being quietly crossed upwards. Every other operation routes to the current business owner. The
     * response says which operation was previewed, so the page can show the real reviewer or reason.
     *
     * It creates no request and is not an authorization token: submit re-runs the same calculation
     * inside its own transaction.
     */
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String, Object> reviewerPreview(Actor actor, Map<String, Object> input) {
        requireBusiness(actor);access.requireCurrent(actor);
        allowed(input, Set.of("taskId", "assigneeIds", "operation"));
        String requestedOperation = command(input, "operation", "kind", null);
        if (requestedOperation != null && !OPERATIONS.contains(requestedOperation)) throw bad("不支持的操作预览类型");
        String requestedTask = optionalId(input.get("taskId"), "taskId");
        boolean creation = requestedOperation != null ? "create".equals(requestedOperation) : requestedTask == null;
        if (!creation && requestedTask == null) throw bad("非创建预览须提供taskId");
        Map<String, Object> task = requestedTask == null ? null : task(actor, requestedTask, false);
        String creatorId = actor.id();
        if (task != null) {
            if (creation) {
                if (s(task, "currentVersionId") != null) throw conflict("TASK_PUBLISHED", "已发布任务不再走创建预览");
                // Only the original applicant may resubmit, so only that person sees its creation route.
                if (!actor.id().equals(s(task, "originalCreatorId"))) throw forbidden("仅原申请人可预览创建重提");
            } else {
                String currentId = s(task, "currentVersionId");
                if (currentId == null || !access.canSeeTask(actor, task, version(actor, currentId), assignees(actor, currentId))) {
                    throw ApiException.notFound();
                }
            }
            creatorId = s(task, "originalCreatorId");
        }
        Route route;
        if (creation) {
            route = creationRoute(actor, creatorId);
            if (input.containsKey("assigneeIds")) {
                // Validated so the page can reject an ineligible person early; it never influences the route.
                validateCreationAssignable(actor, ids(input.get("assigneeIds")));
            }
        } else {
            List<String> owners = input.containsKey("assigneeIds") ? ids(input.get("assigneeIds"))
                    : effectiveOwnersForPreview(actor, task, requestedOperation);
            for (String id : owners) {
                Map<String, Object> person = access.activeUser(actor, id);
                if (person == null || "admin".equals(s(person, "role"))) throw bad("负责人须为本公司有效业务账号");
            }
            validateRequestActor(actor,task,version(actor,s(task,"currentVersionId")),
                    requestedOperation==null?"change":requestedOperation);
            route = route(actor, owners, access.businessOwner(task));
        }
        Map<String, Object> result = new LinkedHashMap<>();
        String operation = requestedOperation == null ? (creation ? "create" : "change") : requestedOperation;
        result.put("operation", operation);
        result.put("mode", creation ? "creation" : "non-creation");
        route=route.forApplicant(actor.id());
        result.put("route", routeView(actor, route));
        result.put("reviewerId", route.reviewerId());
        result.put("requiresApproval", !route.blocked() && !route.directFor(actor.id()));
        result.put("blocked", route.blocked());
        result.put("exemptionReason", route.directFor(actor.id()) ? route.reasonText() : null);
        result.put("blockedReason", route.blocked() ? route.reasonText() : null);
        result.put("reviewerBasis", creation ? "creator" : "business_owner");
        result.put("previewOnly", true);
        return result;
    }

    /**
     * Owners a non-creation preview falls back to when the caller does not send them. Modification and
     * handover change the proposal itself, so their owners must be supplied instead of guessed.
     */
    private List<String> effectiveOwnersForPreview(Actor actor, Map<String, Object> task, String operation) {
        if (task == null) throw bad("非创建预览须提供负责人或taskId");

        String currentId = s(task, "currentVersionId");
        if (currentId == null) throw conflict("TASK_NOT_PUBLISHED", "未发布任务没有非创建审核路线");
        return assignees(actor, currentId);
    }

    /**
     * Dedicated handover preset (V-010 / DEV-004): the person themself or their direct manager chooses
     * the successor for that person's current tasks. The setting is persisted and revalidated when a
     * handover is actually submitted, so an organization change or an inactive target cannot keep
     * working silently.
     */
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String, Object> handoverTargets(Actor actor, String subjectId, String query) {
        requireBusiness(actor);access.requireCurrent(actor);
        Map<String, Object> subject = handoverPresetSubject(actor, subjectId);
        if (query != null && query.length() > 100) throw bad("搜索内容最多100字");
        List<Map<String, Object>> items = access.handoverTargets(access.actor(subject), query).stream()
                .map(row -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    for (String key : List.of("id", "displayName", "departmentId", "departmentName",
                            "positionId", "positionName")) item.put(key, row.get(key));
                    return item;
                }).toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("empty", items.isEmpty());
        result.put("subjectId", subjectId);
        return result;
    }

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String, Object> handoverPreset(Actor actor, String subjectId) {
        requireBusiness(actor);access.requireCurrent(actor);
        handoverPresetSubject(actor, subjectId);
        return handoverPresetView(actor, subjectId);
    }

    public Map<String, Object> saveHandoverPreset(Actor actor, String subjectId, Map<String, Object> input) {
        requireBusiness(actor);
        allowed(input, Set.of("targetUserId"));
        Map<String, Object> subject = handoverPresetSubject(actor, subjectId);
        String targetId = requiredId(input.get("targetUserId"), "targetUserId");
        if (subjectId.equals(targetId)) throw bad("交接对象不能是本人");
        Map<String, Object> target = access.activeUser(actor, targetId);
        if (target == null || !access.canBeHandoverTarget(access.actor(subject), target)) {
            throw bad("交接对象须为本公司有效业务账号且在合法交接范围内");
        }
        if (db.find("SELECT * FROM handover_presets WHERE organization_id=? AND user_id=? FOR UPDATE",
                actor.organizationId(), subjectId) == null) {
            db.update("INSERT INTO handover_presets(organization_id,user_id,target_user_id,set_by_user_id,row_version,updated_at) "
                            + "VALUES(?,?,?,?,1,UTC_TIMESTAMP(6))",
                    actor.organizationId(), subjectId, targetId, actor.id());
        } else {
            db.update("UPDATE handover_presets SET target_user_id=?,set_by_user_id=?,row_version=row_version+1,"
                            + "updated_at=UTC_TIMESTAMP(6) WHERE organization_id=? AND user_id=?",
                    targetId, actor.id(), actor.organizationId(), subjectId);
        }
        events.record(actor, null, "handover.preset.updated", List.of(),
                Map.of("userId", subjectId, "targetUserId", targetId));
        return handoverPresetView(actor, subjectId);
    }

    public Map<String, Object> clearHandoverPreset(Actor actor, String subjectId) {
        requireBusiness(actor);
        handoverPresetSubject(actor, subjectId);
        int deleted = db.update("DELETE FROM handover_presets WHERE organization_id=? AND user_id=?",
                actor.organizationId(), subjectId);
        if (deleted > 0) {
            events.record(actor, null, "handover.preset.cleared", List.of(), Map.of("userId", subjectId));
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", subjectId);
        result.put("cleared", deleted > 0);
        return result;
    }

    private Map<String, Object> handoverPresetSubject(Actor actor, String subjectId) {
        String id = requiredId(subjectId, "userId");
        Map<String, Object> subject = access.activeUser(actor, id);
        if (subject == null) throw ApiException.notFound();
        if (!access.canSetHandoverPreset(actor, subject)) throw forbidden("仅本人或直属领导可设置交接对象");
        return subject;
    }

    private Map<String, Object> handoverPresetView(Actor actor, String subjectId) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", subjectId);
        result.put("targetUserId", null);
        result.put("target", null);
        result.put("rowVersion", 0);
        Map<String, Object> row = db.find("SELECT p.*,u.display_name AS target_name "
                        + "FROM handover_presets p LEFT JOIN users u ON u.organization_id=p.organization_id AND u.id=p.target_user_id "
                        + "WHERE p.organization_id=? AND p.user_id=?",
                actor.organizationId(), subjectId);
        if (row == null) return result;
        result.put("targetUserId", s(row, "targetUserId"));
        result.put("target", Map.of("id", s(row, "targetUserId"),
                "displayName", Objects.toString(row.get("targetName"), "")));
        result.put("setByUserId", s(row, "setByUserId"));
        result.put("rowVersion", n(row, "rowVersion"));
        result.put("updatedAt", row.get("updatedAt"));
        return result;
    }

    private String presetTarget(Actor actor, String subjectId) {
        Map<String, Object> row = db.find("SELECT target_user_id FROM handover_presets WHERE organization_id=? AND user_id=?",
                actor.organizationId(), subjectId);
        return row == null ? null : s(row, "targetUserId");
    }

    /**
     * Dedicated handover (DEV-004): the owner of a task, or that person's direct manager, replaces one
     * assignee position with another person. It can never carry a base field, and the relative order of
     * the remaining assignees is preserved.
     */
    public Map<String, Object> handover(Actor actor, String taskId, String ifMatch, Map<String, Object> input) {
        requireBusiness(actor);
        allowed(input, Set.of("sourceUserId", "targetUserId", "reason"));
        Map<String, Object> task = task(actor, taskId, true);
        String currentId = s(task, "currentVersionId");
        if (currentId == null) throw conflict("TASK_NOT_PUBLISHED", "未发布任务不能交接");
        Map<String, Object> current = version(actor, currentId);
        List<String> currentOwners = assignees(actor, currentId);
        if (!access.canSeeTask(actor, task, current, currentOwners)) throw ApiException.notFound();
        Writes.checkVersion(ifMatch, n(task, "rowVersion"));
        if (pending(actor, taskId, true) != null) throw conflict("TASK_FROZEN", "任务有待审核申请，请先处理或撤销");

        String source = requiredId(input.get("sourceUserId"), "sourceUserId");
        String target = input.get("targetUserId") == null ? presetTarget(actor, source)
                : requiredId(input.get("targetUserId"), "targetUserId");
        if (target == null) throw bad("请选择交接对象，或先保存交接预设");
        if (source.equals(target)) throw bad("交接目标不能与被交接人相同");
        if(currentOwners.contains(target)) throw bad("交接对象已是任务负责人");
        if (!access.canHandover(actor, source, currentOwners)) throw forbidden("仅本人或直属领导可交接该任务");
        Map<String, Object> targetUser = access.activeUser(actor, target);
        Actor sourceActor = access.actor(access.user(actor, source));
        if (targetUser == null || !access.canBeHandoverTarget(sourceActor, targetUser)) {
            throw bad("交接目标须为本公司有效业务账号且在合法交接范围内");
        }
        String reason = input.containsKey("reason") ? requiredText(input, "reason", 500) : "专用交接";

        List<String> newOwners = new ArrayList<>(currentOwners);
        newOwners.set(newOwners.indexOf(source), target);
        Map<String, Object> proposed = new LinkedHashMap<>(current);
        proposed.put("assigneeIds", newOwners);
        // The proposal is the effective snapshot with exactly one owner replaced: no base field can change.
        Map<String, Object> outcome = submit(actor, task, current, proposed, newOwners,
                route(actor, newOwners, access.businessOwner(task)), "handover", reason);
        String requestId = s(outcome, "requestId");
        db.update("INSERT INTO handover_requests(id,organization_id,task_id,request_id,source_user_id,target_user_id,set_by_user_id) VALUES(?,?,?,?,?,?,?)",
                Db.id(), actor.organizationId(), taskId, requestId, source, target, actor.id());
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("sourceUserId", source);
        detail.put("targetUserId", target);
        detail.put("setByUserId", actor.id());
        recordHistory(actor, taskId, requestId, "handover_requested", "assigneeIds", source, target, detail);
        return outcome;
    }

    private void validateHandoverAtApproval(Actor reviewer, String taskId, String requestId, Map<String, Object> base) {
        Map<String, Object> handover = db.find("SELECT * FROM handover_requests WHERE organization_id=? AND request_id=?", reviewer.organizationId(), requestId);
        if (handover == null) throw conflict("HANDOVER_MISSING", "交接记录缺失，无法批准");
        List<String> baseOwners = base == null ? List.of() : assignees(reviewer, s(base, "id"));
        String source = s(handover, "sourceUserId");
        String setBy = s(handover, "setByUserId");
        if (!baseOwners.contains(source)) throw conflict("HANDOVER_SOURCE_CHANGED", "被交接人已不是当前负责人，请重新提交交接");
        Map<String, Object> sourceUser = access.activeUser(reviewer, source);
        if (sourceUser == null) throw conflict("HANDOVER_SOURCE_INACTIVE", "被交接人已不可用，请重新提交交接");
        Map<String, Object> setter = access.activeUser(reviewer, setBy);
        if (setter == null) throw conflict("HANDOVER_SETTER_INACTIVE", "交接设定人已不可用，请重新提交交接");
        if (!access.canHandover(access.actor(setter), source, baseOwners)) {
            throw conflict("HANDOVER_NOT_ALLOWED", "交接设定人已不具备该任务的交接权限，请重新提交交接");
        }
        Map<String, Object> targetUser = access.activeUser(reviewer, s(handover, "targetUserId"));
        if (targetUser == null || !access.canBeHandoverTarget(access.actor(sourceUser), targetUser)) {
            throw conflict("HANDOVER_TARGET_INVALID", "交接对象已失效或不在合法范围内，请重新提交交接");
        }
    }

    /** Administration console: the complete operation history of one task (DEV-016). Never exposed to the App. */
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String, Object> taskHistory(Actor actor, String taskId) {
        access.requireCapability(actor, "view_task_history");access.requireCurrent(actor);
        Map<String, Object> task = db.find("SELECT id,organization_id,original_creator_id,execution_state,created_at FROM tasks WHERE organization_id=? AND id=?", actor.organizationId(), taskId);
        if (task == null) throw ApiException.notFound();
        List<Map<String, Object>> entries = new ArrayList<>();
        for (Map<String, Object> row : db.list("SELECT h.*,COALESCE(u.display_name,ad.display_name) AS actor_name,p.account_type AS actor_account_type FROM task_history_entries h "
                + "LEFT JOIN principals p ON p.organization_id=h.organization_id AND p.id=h.actor_id "
                + "LEFT JOIN users u ON u.organization_id=p.organization_id AND u.id=p.id "
                + "LEFT JOIN admin_accounts ad ON ad.organization_id=p.organization_id AND ad.id=p.id "
                + "WHERE h.organization_id=? AND h.task_id=? ORDER BY h.occurred_at,h.id", actor.organizationId(), taskId)) {
            Map<String, Object> entry = new LinkedHashMap<>();
            for (String key : List.of("id", "entryType", "fieldName", "beforeValue", "afterValue",
                    "actorId", "actorName", "requestId", "occurredAt")) {
                entry.put(key, row.get(key));
            }
            entry.put("detail", row.get("detailJson") == null ? Map.of() : db.parse(s(row, "detailJson")));
            entries.add(entry);
        }
        List<Map<String, Object>> versions = new ArrayList<>();
        for (Map<String, Object> row : db.list("SELECT id,version_no,status,title,priority,all_day,start_at,due_at,execution_state,progress_note,created_by,created_at,applied_at,expired_at FROM task_versions WHERE organization_id=? AND task_id=? ORDER BY version_no,id", actor.organizationId(), taskId)) {
            List<String> order = assignees(actor, s(row, "id"));
            row.put("assigneeIds", order);
            versions.add(row);
        }
        List<Map<String, Object>> reassignments = db.list("SELECT * FROM request_reassignments WHERE organization_id=? AND task_id=? ORDER BY created_at,id", actor.organizationId(), taskId);
        List<Map<String, Object>> handovers = db.list("SELECT * FROM handover_requests WHERE organization_id=? AND task_id=? ORDER BY created_at,id", actor.organizationId(), taskId);
        // The console shows ordered assignee names, not raw ids. Resolve every referenced person once;
        // only id and display name are returned, never a phone, e-mail or credential.
        Set<String> people = new LinkedHashSet<>();
        addIfPresent(people, s(task, "originalCreatorId"));
        for (Map<String, Object> row : versions) {
            addIfPresent(people, s(row, "createdBy"));
            people.addAll((List<String>) row.get("assigneeIds"));
        }
        for (Map<String, Object> row : reassignments) {
            addIfPresent(people, s(row, "previousReviewerId"));
            addIfPresent(people, s(row, "newReviewerId"));
            addIfPresent(people, s(row, "basisAssigneeId"));
        }
        for (Map<String, Object> row : handovers) {
            addIfPresent(people, s(row, "sourceUserId"));
            addIfPresent(people, s(row, "targetUserId"));
            addIfPresent(people, s(row, "setByUserId"));
        }
        for (Map<String, Object> entry : entries) {
            addIfPresent(people, s(entry, "actorId"));
            if (Set.of("assignee_order", "reviewer_reassigned", "handover").contains(s(entry, "entryType"))) {
                addIfPresent(people, s(entry, "beforeValue"));
                addIfPresent(people, s(entry, "afterValue"));
            }
            Object detail = entry.get("detail");
            if (detail instanceof Map<?, ?> map) {
                for (String key : List.of("sourceUserId", "targetUserId", "setByUserId", "reviewerId")) {
                    addIfPresent(people, map.get(key) instanceof String text ? text : null);
                }
                for (String key : List.of("beforeOrder", "afterOrder")) {
                    if (map.get(key) instanceof List<?> list) {
                        for (Object value : list) addIfPresent(people, value instanceof String text ? text : null);
                    }
                }
            }
        }
        Map<String, String> names = userNameMap(actor);
        Map<String, String> resolved = new LinkedHashMap<>();
        for (String id : people) resolved.put(id, names.getOrDefault(id, id));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("taskId", taskId);
        result.put("originalCreatorId", s(task, "originalCreatorId"));
        result.put("businessOwnerId",access.businessOwner(task));
        result.put("businessTransfers",db.list("SELECT * FROM task_business_transfers WHERE organization_id=? AND task_id=? ORDER BY occurred_at,id",actor.organizationId(),taskId));
        result.put("originalCreatorName", names.getOrDefault(s(task, "originalCreatorId"), s(task, "originalCreatorId")));
        result.put("executionState", s(task, "executionState"));
        result.put("createdAt", task.get("createdAt"));
        result.put("entries", entries);
        result.put("versions", versions);
        result.put("reassignments", reassignments);
        result.put("handovers", handovers);
        result.put("people", resolved);
        return result;
    }

    private static void addIfPresent(Set<String> ids, String id) {
        if (id != null && !id.isBlank()) ids.add(id);
    }

    /** Startup migration is deliberately narrower than an explicit organization-plan route refresh. */
    static final String LEGACY_CREATION_ROUTES = "status='pending' AND kind='create' "
            + "AND route_reason IN ('manager-chain','creator-fallback','no-reviewer')";

    /** Refresh under the company lock: expire first, then validate applicant and current route. */
    public int refreshPendingRoutes(Actor actor) {
        return refreshRoutes(actor,"status='pending'");
    }

    private int refreshRoutes(Actor actor,String predicate) {
        int moved=0;
        for(var request:db.list("SELECT * FROM approval_requests WHERE organization_id=? AND " + predicate
                + " ORDER BY created_at,id FOR UPDATE",actor.organizationId())) {
            var task=db.find("SELECT * FROM tasks WHERE organization_id=? AND id=?",actor.organizationId(),s(request,"taskId"));
            if(task==null) continue;
            Instant deadline=applicableDeadline(actor,request);
            if(deadline==null || !clock.instant().isBefore(deadline)) {
                expiry.expire(actor.organizationId(),request,clock.instant(),"route_refresh_after_deadline");moved++;continue;
            }
            Route route=currentRoute(actor,task,request);
            if(!route.blocked()) {
                try {
                    var proposed=version(actor,s(request,"proposedVersionId"));
                    var base=s(request,"baseVersionId")==null?null:version(actor,s(request,"baseVersionId"));
                    validateApplicationEffect(actor,task,request,proposed,base,s(request,"kind"));
                } catch(ApiException invalid) {
                    route=new Route(null,route.basisAssigneeId(),List.of(),"applicant-unavailable",
                            routeReasonText("applicant-unavailable"),actor.authzVersion(),true,route.creation());
                }
            }
            if(route.blocked()) {recordBlockedRoute(actor,task,request,route,reviewerOfRecord(request));moved++;continue;}
            if(route.directFor(s(request,"applicantId"))) {if(applyWithoutReviewer(actor,task,request,route)) moved++;continue;}
            if(!Objects.equals(reviewerOfRecord(request),route.reviewerId()) || !Objects.equals(s(request,"routeReason"),route.reason())) {reassignReviewer(actor,task,request,route);moved++;}
        }
        return moved;
    }

    /**
     * Re-decide creations that were pending under the previous rules (chapter 3.4). Only requests whose
     * stored route still carries a legacy reason code are touched, so a request created by the current
     * code is never recomputed just because the application restarted. Each moved request writes the
     * same reassignment/blocked records the on-line organization refresh writes, and a request whose
     * relationship became a legitimate exemption is applied with the recorded reason and version guard.
     */
    public int refreshLegacyCreationRoutes(Actor actor) {
        return refreshRoutes(actor,LEGACY_CREATION_ROUTES);
    }

    /**
     * SQL and argument contract for applying a request with no reviewer. Kept in one place so the
     * placeholder count and the argument count cannot drift apart (V-003).
     */
    static final String NO_REVIEWER_APPLY_SQL = "UPDATE approval_requests SET status='direct',"
            + "current_reviewer_id=NULL,exemption_reason=?,route_basis_assignee_id=?,route_reason=?,"
            + "route_authz_version=?,decided_at=?,decided_by=?,route_refreshed_at=UTC_TIMESTAMP(6),"
            + "row_version=row_version+1 WHERE organization_id=? AND id=? AND status='pending' AND row_version=?";

    static Object[] noReviewerApplyArgs(Route route, Timestamp now, String organizationId, String requestId,
                                        long requestRowVersion,String applicantId) {
        return new Object[]{route.reasonText(), route.basisAssigneeId(), route.reason(), route.authzVersion(),
                now,applicantId, organizationId, requestId, requestRowVersion};
    }

    /**
     * Re-checks the current effects of an approval against live authority. Explicit decisions and the
     * reviewer-less automatic path share this so a revoked dispatch range, a stale participant/parent or a
     * losing handover setter cannot be bypassed just because no reviewer remains (V-008).
     */
    private void validateApplicationEffect(Actor context, Map<String, Object> task, Map<String, Object> request,
                                           Map<String, Object> proposed, Map<String, Object> base, String kind) {
        String taskId = s(task, "id");
        String requestId = s(request, "id");
        if(!Objects.equals(s(task,"currentVersionId"),s(request,"baseVersionId")))
            throw conflict("STALE_BASE_VERSION","任务有效版本已变化");
        if("reopen".equals(kind) ? !"done".equals(s(task,"executionState"))
                : !"create".equals(kind) && "done".equals(s(task,"executionState")))
            throw conflict("INVALID_TASK_STATE","任务状态已不适用该申请");
        List<String> newOwners = assignees(context, s(proposed, "id"));
        validateActiveOwners(context, newOwners);
        Actor applicant = activeActor(context, s(request, "applicantId"));
        // A creation (and its resubmission) is approved against the same company-wide candidate rule the
        // submit used; published assignee edits and reopen use the company-wide employee range too.
        if ("create".equals(kind)) validateCreationAssignable(applicant, newOwners);
        else if (Set.of("change","reopen").contains(kind)) validateAssignable(applicant, newOwners);
        // A handover is re-checked at approval: the setter must still hold the dedicated authority and
        // the source must still be the current owner (DEV-004).
        if ("handover".equals(kind)) validateHandoverAtApproval(context, taskId, requestId, base);
        validateParent(applicant, taskId, s(proposed, "parentTaskId"),
                base == null || !Objects.equals(s(base, "parentTaskId"), s(proposed, "parentTaskId")));
        validateRequestActor(applicant, task, base, kind);
    }

    /**
     * An unusable relationship keeps the proposal frozen, clears the current reviewer and records why.
     */
    private void recordBlockedRoute(Actor actor, Map<String, Object> task, Map<String, Object> request,
                                            Route route, String previous) {
        String requestId = s(request, "id");
        String taskId = s(task, "id");
        if (Objects.equals(route.reason(), Objects.toString(request.get("routeReason"), ""))) return;
        db.update("UPDATE approval_requests SET current_reviewer_id=NULL,route_basis_assignee_id=?,route_reason=?,route_authz_version=?,route_refreshed_at=UTC_TIMESTAMP(6),row_version=row_version+1 WHERE organization_id=? AND id=?",
                route.basisAssigneeId(), route.reason(), route.authzVersion(), actor.organizationId(), requestId);
        db.update("INSERT INTO request_reassignments(id,organization_id,request_id,task_id,previous_reviewer_id,new_reviewer_id,basis_assignee_id,reason,source) VALUES(?,?,?,?,?,NULL,?,?,'route_refresh')",
                Db.id(), actor.organizationId(), requestId, taskId, previous, route.basisAssigneeId(), route.reasonText());
        recordHistory(actor, taskId, requestId, "route_blocked", "reviewerId", previous, null,
                Map.of("reason", route.reason(), "source", "route_refresh"));
        Set<String> recipients = new LinkedHashSet<>();
        recipients.add(s(request, "applicantId"));
        recipients.add(previous);
        recipients.remove(null);
        events.record(actor, taskId, "task."+s(request,"kind")+".route_blocked", recipients,
                Map.of("requestId", requestId, "kind", s(request,"kind"), "reason", route.reason()),
                requestId, s(request, "proposedVersionId"), titleOf(actor, request),
                "任务《" + titleOf(actor, request) + "》的审核被阻断：" + route.reasonText());
    }

    /** Apply only a valid founder exemption or a refreshed route whose reviewer is the applicant. */
    private boolean applyWithoutReviewer(Actor actor, Map<String, Object> task, Map<String, Object> request, Route route) {
        if(route.blocked() || !route.directFor(s(request,"applicantId")) || !"pending".equals(s(request,"status"))) return false;
        Instant deadline=applicableDeadline(actor,request);
        if(deadline==null || !clock.instant().isBefore(deadline)) {
            expiry.expire(actor.organizationId(),request,clock.instant(),"direct_refresh_after_deadline");return false;
        }
        route=route.forApplicant(s(request,"applicantId"));
        String taskId = s(task, "id");
        String requestId = s(request, "id");
        String kind = s(request, "kind");
        Map<String, Object> proposed = version(actor, s(request, "proposedVersionId"));
        Map<String, Object> base = s(request, "baseVersionId") == null ? null : version(actor, s(request, "baseVersionId"));
        try {
            validateApplicationEffect(actor, task, request, proposed, base, kind);
        } catch (ApiException blocked) {
            // The organization change itself must still complete. The old proposal stays pending and
            // frozen; it can never be published with authority the applicant no longer holds, and it is
            // ended by the documented deadline/withdrawal paths instead of a fabricated approval.
            return false;
        }
        Timestamp now = now();
        int changed = db.update(NO_REVIEWER_APPLY_SQL,
                noReviewerApplyArgs(route, now, actor.organizationId(), requestId, n(request, "rowVersion"),s(request,"applicantId")));
        if (changed != 1) return false;
        db.update("UPDATE task_versions SET status='applied' WHERE organization_id=? AND id=? AND status='proposed'", actor.organizationId(), s(proposed, "id"));
        Actor applicant=activeActor(actor,s(request,"applicantId"));
        applyVersion(applicant, task, base, proposed, kind, "create".equals(kind) ? "created" : "approval");
        db.update("UPDATE task_records SET effective_at=? WHERE organization_id=? AND request_id=?", now, actor.organizationId(), requestId);
        db.update("INSERT INTO request_reassignments(id,organization_id,request_id,task_id,previous_reviewer_id,new_reviewer_id,basis_assignee_id,reason,source) VALUES(?,?,?,?,?,NULL,?,?,'route_refresh')",
                Db.id(), actor.organizationId(), requestId, taskId, reviewerOfRecord(request), route.basisAssigneeId(), route.reasonText());
        recordHistory(applicant, taskId, requestId, "no_reviewer", "exemptionReason", null, route.reasonText(),
                Map.of("basisAssigneeId", Objects.toString(route.basisAssigneeId(), ""), "source", "route_refresh", "refreshActorId",actor.id()));
        Map<String,Object> details=new LinkedHashMap<>(Map.of("requestId", requestId, "kind", kind,
                "status", "direct", "reason", route.reason(),"refreshActorId",actor.id()));
        List<String> removed=base==null?new ArrayList<>():new ArrayList<>(assignees(actor,s(base,"id")));
        removed.removeAll(assignees(actor,s(proposed,"id")));
        if(!removed.isEmpty()) details.put("removedUserIds",removed);
        events.record(applicant, taskId, "task." + kind + ".direct",
                recipients(task,base,proposed,applicant.id(),route.reviewerId(),false,true),details,
                requestId, s(proposed, "id"), s(proposed, "title"),
                "任务《" + s(proposed, "title") + "》已直接生效："+route.reasonText());
        return true;
    }

    /**
     * Persist a creation reviewer change discovered while deciding (chapter 3.4). The request keeps its
     * original reviewer only until this row is written; afterwards the old reviewer's page is refused
     * with REVIEWER_CHANGED and the new reviewer owns the decision.
     */
    private void reassignReviewer(Actor actor, Map<String, Object> task, Map<String, Object> request, Route route) {
        String requestId = s(request, "id");
        String taskId = s(task, "id");
        String previous = reviewerOfRecord(request);
        db.update("UPDATE approval_requests SET current_reviewer_id=?,route_basis_assignee_id=?,route_reason=?,route_authz_version=?,route_refreshed_at=UTC_TIMESTAMP(6),row_version=row_version+1 WHERE organization_id=? AND id=?",
                route.reviewerId(), route.basisAssigneeId(), route.reason(), route.authzVersion(), actor.organizationId(), requestId);
        db.update("INSERT INTO request_reassignments(id,organization_id,request_id,task_id,previous_reviewer_id,new_reviewer_id,basis_assignee_id,reason,source) VALUES(?,?,?,?,?,?,?,?,'route_refresh')",
                Db.id(), actor.organizationId(), requestId, taskId, previous, route.reviewerId(),
                route.basisAssigneeId(), route.reasonText());
        recordHistory(actor, taskId, requestId, "reviewer_reassigned", "reviewerId", previous, route.reviewerId(),
                Map.of("reason", route.reason(), "source", "route_refresh"));
        Set<String> recipients = new LinkedHashSet<>();
        recipients.add(s(request, "applicantId"));
        recipients.add(previous);
        recipients.add(route.reviewerId());
        recipients.add(access.businessOwner(task));
        recipients.remove(null);
        events.record(actor, taskId, "task."+s(request,"kind")+".reassigned", recipients,
                Map.of("requestId", requestId, "kind", s(request,"kind"),
                        "previousReviewerId", Objects.toString(previous, ""), "reviewerId", route.reviewerId()),
                requestId, s(request, "proposedVersionId"), titleOf(actor, request),
                "任务《" + titleOf(actor, request) + "》的审核人已按当前责任关系调整，请重新处理。");
    }

    /** Best-effort applicable deadline: the stored snapshot, else the route's own version deadline. */
    private Instant applicableDeadline(Actor actor, Map<String, Object> request) {
        Object stored = request.get("applicableDeadline");
        if (stored != null) return instant(stored, "applicableDeadline");
        String kind = s(request, "kind");
        String versionId = Set.of("create", "change", "reopen", "handover").contains(kind)
                ? s(request, "proposedVersionId")
                : Objects.toString(request.get("baseVersionId"), s(request, "proposedVersionId"));
        Map<String, Object> row = db.find("SELECT due_at FROM task_versions WHERE organization_id=? AND id=?", actor.organizationId(), versionId);
        return row == null || row.get("dueAt") == null ? null : instant(row.get("dueAt"), "dueAt");
    }

    private Map<String, Object> submit(Actor actor, Map<String, Object> task, Map<String, Object> base, Map<String, Object> proposed, List<String> owners, Route route, String kind, String body) {
        String taskId = s(task, "id");
        Instant deadline = expiry.applicableDeadline(kind, base, proposed);
        Instant submittedAt = clock.instant();
        if (deadline == null || !submittedAt.isBefore(deadline)) {
            throw conflict("DEADLINE_PASSED", "提交的排期或当前有效截止时间已到，请调整后重提");
        }
        // The fixed founder and an applicant who is the actual reviewer apply through the same version path.
        route=route.forApplicant(actor.id());
        if(route.blocked()) throw conflict("ROUTE_BLOCKED",route.reasonText());
        boolean direct=route.directFor(actor.id());
        if(!Objects.equals(s(task,"currentVersionId"),base==null?null:s(base,"id")))
            throw conflict("STALE_BASE_VERSION","任务有效版本已变化，请重新提交");
        validateActiveOwners(actor,owners);
        validateRequestActor(actor,task,base,kind);
        String versionId = insertVersion(actor, taskId, proposed, owners, direct ? "applied" : "proposed");
        proposed.put("id", versionId);
        String requestId = Db.id();
        Timestamp now = Timestamp.from(submittedAt);
        db.update("INSERT INTO approval_requests(id,organization_id,task_id,proposed_version_id,applicant_id,current_reviewer_id,kind,status,comment,base_version_id,previous_state,row_version,created_at,decided_at,decided_by,exemption_reason,route_basis_assignee_id,route_reason,route_authz_version,applicable_deadline) VALUES(?,?,?,?,?,?,?,?,NULL,?,?,1,?,?,?,?,?,?,?,?)",
                requestId, actor.organizationId(), taskId, versionId, actor.id(), route.reviewerId(),
                kind, direct ? "direct" : "pending", base == null ? null : s(base, "id"),
                s(task, "executionState"), now, direct ? now : null,direct?actor.id():null,
                direct ? route.reasonText() : null, route.basisAssigneeId(), route.reason(), route.authzVersion(),
                Timestamp.from(deadline));
        if (body != null) insertRecord(actor, taskId, requestId, body, kind, direct);
        Map<String, Object> submitted = new LinkedHashMap<>();
        submitted.put("kind", kind);
        submitted.put("status", direct ? "direct" : "pending");
        submitted.put("reviewerId", Objects.toString(route.reviewerId(), ""));
        submitted.put("basisAssigneeId", Objects.toString(route.basisAssigneeId(), ""));
        submitted.put("routeReason", route.reason());
        recordHistory(actor, taskId, requestId, "request_submitted", null, null, null, submitted);
        recordFieldChanges(actor, taskId, requestId, base, proposed, owners);
        if (direct) {
            recordHistory(actor, taskId, requestId, "no_reviewer", "exemptionReason", null, route.reasonText(),
                    Map.of("basisAssigneeId", Objects.toString(route.basisAssigneeId(), "")));
            applyVersion(actor, task, base, proposed, kind, "create".equals(kind) ? "created" : "approval");
        } else if (base != null || n(task, "rowVersion") > 1) {
            db.update("UPDATE tasks SET row_version=row_version+1,updated_at=? WHERE organization_id=? AND id=?", now, actor.organizationId(), taskId);
        }
        Set<String> eventRecipients;
        if (direct) {
            eventRecipients = recipients(task, base, proposed, actor.id(), route.reviewerId(), false, true);
        } else if (base == null) {
            // An unpublished creation is visible only to its applicant and the reviewer of record.
            eventRecipients = new LinkedHashSet<>();
            eventRecipients.add(actor.id());
            eventRecipients.add(route.reviewerId());
            eventRecipients.remove(null);
        } else {
            // A published task's submission notifies only the reviewer of record; the applicant tracks it.
            eventRecipients = route.reviewerId() == null ? Set.of(actor.id()) : Set.of(route.reviewerId());
        }
        Map<String, Object> eventDetails = new LinkedHashMap<>();
        eventDetails.put("requestId", requestId);
        eventDetails.put("kind", kind);
        eventDetails.put("status", direct ? "direct" : "pending");
        eventDetails.put("reviewerId", Objects.toString(route.reviewerId(), ""));
        if (base != null && direct) {
            // assignees() returns an immutable list; removal events need a mutable working copy.
            List<String> previousOwners = new ArrayList<>(assignees(actor, s(base, "id")));
            previousOwners.removeAll(owners);
            if (!previousOwners.isEmpty()) eventDetails.put("removedUserIds", previousOwners);
        }
        events.record(actor, taskId, "task." + kind + "." + (direct ? "applied" : "submitted"),
                eventRecipients, eventDetails, requestId, versionId, s(proposed, "title"),
                eventSummary(actor, kind, direct ? "applied" : "submitted", base, proposed));
        return result(taskId, requestId, direct ? "direct" : "pending", n(task(actor, taskId, false), "rowVersion"));
    }

    /** One durable history row per real change; the App never reads these (DEV-016). */
    private void recordHistory(Actor actor, String taskId, String requestId, String entryType,
                               String fieldName, String before, String after, Map<String, Object> detail) {
        db.update("INSERT INTO task_history_entries(id,organization_id,task_id,request_id,actor_id,entry_type,field_name,before_value,after_value,detail_json) VALUES(?,?,?,?,?,?,?,?,?,?)",
                Db.id(), actor.organizationId(), taskId, requestId, actor.id(), entryType, fieldName,
                before, after, db.json(detail == null ? Map.of() : detail));
    }

    /** Field-by-field and ordered-assignee differences between the effective and the proposed snapshot. */
    private void recordFieldChanges(Actor actor, String taskId, String requestId, Map<String, Object> base,
                                    Map<String, Object> proposed, List<String> owners) {
        if (base == null) {
            recordHistory(actor, taskId, requestId, "version_created", null, null, null,
                    Map.of("versionId", Objects.toString(s(proposed, "id"), "")));
            return;
        }
        for (String field : FORM_FIELDS) {
            if ("assigneeIds".equals(field)) continue;
            String before = tagAware(base, field);
            String after = tagAware(proposed, field);
            if (!Objects.equals(before, after)) {
                recordHistory(actor, taskId, requestId, "field_change", field, before, after, Map.of());
            }
        }
        List<String> beforeOrder = assignees(actor, s(base, "id"));
        if (!beforeOrder.equals(owners)) {
            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("beforeOrder", beforeOrder);
            detail.put("afterOrder", owners);
            recordHistory(actor, taskId, requestId, "assignee_order", "assigneeIds",
                    String.join(",", beforeOrder), String.join(",", owners), detail);
        }
    }

    /** The tag id is stored, but people compare the tag name; everything else stays its plain value. */
    private static String tagAware(Map<String, Object> snapshot, String field) {
        if (snapshot == null) return null;
        if ("tagId".equals(field)) {
            return (String) snapshot.getOrDefault("tagNameSnapshot", snapshot.get("tagId"));
        }
        return plain(snapshot.get(field));
    }

    private static String plain(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    /** One human-readable message per operation, listing the actual changed fields (DEV-030). */
    private String eventSummary(Actor actor, String kind, String status, Map<String, Object> base, Map<String, Object> proposed) {
        String title = s(proposed, "title");
        String label = ExpiryService.kindLabel(kind);
        String changes = changesText(actor, base, proposed);
        return switch (status == null ? "" : status) {
            case "submitted" -> "提交" + label + "任务《" + title + "》，等待审核。" + changes;
            case "direct", "applied" -> "任务《" + title + "》的" + label + "已生效。" + changes;
            case "approved" -> "任务《" + title + "》的" + label + "申请已通过。" + changes;
            case "rejected" -> "任务《" + title + "》的" + label + "申请已退回，请查看审核意见。";
            case "withdrawn" -> "任务《" + title + "》的" + label + "申请已撤销。";
            case "expired" -> "任务《" + title + "》的" + label + "申请已失效，请调整后重提。";
            default -> "任务《" + title + "》的" + label + "状态已更新。" + changes;
        };
    }

    private String changesText(Actor actor, Map<String, Object> base, Map<String, Object> proposed) {
        List<Map<String, Object>> changes = diff(actor, base, proposed);
        if (changes.isEmpty()) return "";
        StringBuilder text = new StringBuilder("本次变化：");
        for (Map<String, Object> change : changes) {
            if (text.length() > 800) break;
            String field = Objects.toString(change.get("field"), "");
            String before = Objects.toString(change.get("before"), "");
            String after = Objects.toString(change.get("after"), "");
            if ("assigneeIds".equals(field)) {
                before = names(actor, before);
                after = names(actor, after);
            } else if ("priority".equals(field)) {
                before = priorityLabel(before);
                after = priorityLabel(after);
            }
            text.append(fieldLabel(field)).append('：').append(abbreviate(before)).append("→").append(abbreviate(after)).append("；");
        }
        return text.toString();
    }

    private String names(Actor actor, String csv) {
        if (csv == null || csv.isBlank()) return "无";
        List<String> ids = Arrays.asList(csv.split(","));
        Map<String, String> names = new LinkedHashMap<>();
        for (Map<String, Object> row : db.list("SELECT id,display_name FROM users WHERE organization_id=? ORDER BY display_name,id", actor.organizationId())) {
            names.put(s(row, "id"), s(row, "displayName"));
        }
        List<String> result = new ArrayList<>();
        for (String id : ids) result.add(names.getOrDefault(id, id));
        return String.join("、", result);
    }

    private String titleOf(Actor actor, Map<String, Object> request) {
        Map<String, Object> version = version(actor, s(request, "proposedVersionId"));
        return version == null ? "任务" : s(version, "title");
    }

    private static String fieldLabel(String field) {
        return switch (field) {
            case "title" -> "标题";
            case "description" -> "说明";
            case "acceptanceCriteria" -> "完成标准";
            case "priority" -> "紧急程度";
            case "allDay" -> "全天";
            case "startAt" -> "开始时间";
            case "dueAt" -> "截止时间";
            case "startDate" -> "开始日期";
            case "dueDate" -> "截止日期";
            case "assigneeIds" -> "负责人";
            case "parentTaskId" -> "上级任务";
            case "tagId" -> "标签";
            default -> field;
        };
    }

    private static String priorityLabel(String value) {
        return switch (value == null ? "" : value) {
            case "urgent" -> "紧急";
            case "high" -> "高";
            case "medium" -> "中";
            case "low" -> "低";
            default -> value;
        };
    }

    private static String abbreviate(String value) {
        if (value == null) return "空";
        return value.length() <= 60 ? value : value.substring(0, 60) + "…";
    }

    private void applyVersion(Actor actor, Map<String, Object> task, Map<String, Object> base, Map<String, Object> proposed, String kind, String assignmentSource) {
        // schedule_version is the reminder/schedule identity (DEV-014): only a real start/end/all-day
        // change bumps it. Execution round changes only on an approved reopen. due_version is retained
        // for historical rows but is deliberately no longer written.
        boolean scheduleChanged = base != null && ExpiryService.scheduleChanged(base, proposed);
        db.update("UPDATE tasks SET current_version_id=?,execution_state=?,row_version=row_version+1,"
                        + "execution_round=execution_round+?,schedule_version=schedule_version+?,"
                        + "all_day_cutoff_time=?,updated_at=? WHERE organization_id=? AND id=?",
                s(proposed, "id"), s(proposed, "executionState"), "reopen".equals(kind) ? 1 : 0,
                scheduleChanged ? 1 : 0, cutoffTime(proposed.get("allDayCutoffTime")),
                now(), actor.organizationId(), s(task, "id"));
        syncAssignments(actor, s(task, "id"), s(proposed, "id"), assignees(actor, s(proposed, "id")), assignmentSource);
    }

    /**
     * Keep one active assignment row per current owner. Existing owners keep their original
     * assigned_at across reorders and schedule changes; a removed owner is deactivated and a later
     * re-add creates a fresh row with a fresh dispatch time.
     */
    private void syncAssignments(Actor actor, String taskId, String versionId, List<String> owners, String source) {
        Map<String, Object> current = db.one("SELECT schedule_version,execution_round FROM tasks WHERE organization_id=? AND id=?", actor.organizationId(), taskId);
        long scheduleVersion = current.get("scheduleVersion") == null ? 1 : n(current, "scheduleVersion");
        int executionRound = current.get("executionRound") == null ? 1 : Math.toIntExact(n(current, "executionRound"));
        Timestamp now = now();
        List<Map<String, Object>> active = db.list("SELECT id,user_id FROM task_assignments WHERE organization_id=? AND task_id=? AND active=TRUE", actor.organizationId(), taskId);
        Set<String> activeUsers = new LinkedHashSet<>();
        for (Map<String, Object> row : active) {
            String user = s(row, "userId");
            if (owners.contains(user)) {
                activeUsers.add(user);
                db.update("UPDATE task_assignments SET version_id=?,schedule_version=?,execution_round=? WHERE organization_id=? AND id=?",
                        versionId, scheduleVersion, executionRound, actor.organizationId(), s(row, "id"));
            } else {
                db.update("UPDATE task_assignments SET active=FALSE,removed_at=? WHERE organization_id=? AND id=?",
                        now, actor.organizationId(), s(row, "id"));
            }
        }
        for (String owner : owners) {
            if (activeUsers.contains(owner)) continue;
            db.update("INSERT INTO task_assignments(id,organization_id,task_id,version_id,user_id,assigned_at,assigned_source,schedule_version,execution_round,active) VALUES(?,?,?,?,?,?,?,?,?,TRUE)",
                    Db.id(), actor.organizationId(), taskId, versionId, owner, now, source, scheduleVersion, executionRound);
        }
    }

    private Set<String> pinnedIds(Actor actor) {
        return new LinkedHashSet<>(db.list("SELECT task_id FROM user_task_pins WHERE organization_id=? AND user_id=?", actor.organizationId(), actor.id())
                .stream().map(row -> s(row, "taskId")).toList());
    }

    private boolean isPinned(Actor actor, String taskId) {
        return db.find("SELECT 1 FROM user_task_pins WHERE organization_id=? AND user_id=? AND task_id=?",
                actor.organizationId(), actor.id(), taskId) != null;
    }

    public Map<String, Object> setPinned(Actor actor, String taskId, boolean pinned) {
        requireBusiness(actor);
        Map<String, Object> task = task(actor, taskId, false);
        String current = s(task, "currentVersionId");
        if (current == null) throw conflict("TASK_NOT_PUBLISHED", "未发布任务不能置顶");
        Map<String, Object> version = version(actor, current);
        List<String> owners = assignees(actor, current);
        if (!access.canSeeTask(actor, task, version, owners)) throw ApiException.notFound();
        if (pinned) {
            db.update("INSERT IGNORE INTO user_task_pins(organization_id,user_id,task_id) VALUES(?,?,?)",
                    actor.organizationId(), actor.id(), taskId);
        } else {
            db.update("DELETE FROM user_task_pins WHERE organization_id=? AND user_id=? AND task_id=?",
                    actor.organizationId(), actor.id(), taskId);
        }
        return Map.of("taskId", taskId, "pinned", pinned);
    }

    private String insertVersion(Actor actor, String taskId, Map<String, Object> values, List<String> owners, String status) {
        String id = Db.id();
        db.update("INSERT INTO task_versions(id,organization_id,task_id,version_no,title,description,acceptance_criteria,priority,all_day,start_at,due_at,start_date,due_date,execution_state,progress_note,parent_task_id,status,created_by,created_at,all_day_cutoff_time,tag_id,tag_name_snapshot,tag_color_snapshot) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                id, actor.organizationId(), taskId, nextVersionNumber(actor, taskId), values.get("title"), values.get("description"), values.get("acceptanceCriteria"), values.get("priority"), bool(values.get("allDay"), "allDay"), Timestamp.from(instant(values.get("startAt"), "startAt")), Timestamp.from(instant(values.get("dueAt"), "dueAt")), values.get("startDate"), values.get("dueDate"), values.get("executionState"), values.get("progressNote"), values.get("parentTaskId"), status, actor.id(), now(), cutoffTime(values.get("allDayCutoffTime")), values.get("tagId"), values.get("tagNameSnapshot"), values.get("tagColorSnapshot"));
        int ordinal = 0;
        for (String owner : owners) {
            db.update("INSERT INTO task_version_assignees(organization_id,version_id,user_id,ordinal,order_source) VALUES(?,?,?,?,?)",
                    actor.organizationId(), id, owner, ordinal++, "submitted");
        }
        return id;
    }

    private int nextVersionNumber(Actor actor, String taskId) {
        return Math.toIntExact(n(db.one("SELECT COALESCE(MAX(version_no),0)+1 AS next_version FROM task_versions WHERE organization_id=? AND task_id=?", actor.organizationId(), taskId), "nextVersion"));
    }

    private void insertRecord(Actor actor, String taskId, String requestId, String body, String kind, boolean effective) {
        Timestamp now = now();
        db.update("INSERT INTO task_records(id,organization_id,task_id,request_id,author_id,body,kind,effective_at,created_at) VALUES(?,?,?,?,?,?,?,?,?)", Db.id(), actor.organizationId(), taskId, requestId, actor.id(), body, kind, effective ? now : null, now);
    }

    private Map<String, Object> taskView(Actor actor, Map<String, Object> task, Map<String, Object> version, List<String> owners) {
        Map<String, Object> result = snapshotView(actor, version);
        result.put("versionId", s(version, "id"));
        result.put("currentVersionId", s(version, "id"));
        result.put("id", s(task, "id"));
        result.put("taskId", s(task, "id"));
        result.put("originalCreatorId", s(task, "originalCreatorId"));
        result.put("businessOwnerId",access.businessOwner(task));
        result.put("rowVersion", n(task, "rowVersion"));
        result.put("executionRound", n(task, "executionRound"));
        result.put("scheduleVersion", task.get("scheduleVersion") == null ? 1 : n(task, "scheduleVersion"));
        result.put("allDayCutoffTime", task.get("allDayCutoffTime") == null ? null : task.get("allDayCutoffTime").toString());
        result.put("dueVersion", n(task, "dueVersion"));
        result.put("published", true);
        result.put("createdAt", task.get("createdAt"));
        result.put("updatedAt", task.get("updatedAt"));
        Map<String, Object> request = pending(actor, s(task, "id"), false);
        result.put("pending", request != null);
        result.put("frozen", request != null);
        result.put("pendingKind", request == null ? null : s(request, "kind"));
        if (request != null && canSeeRequest(actor, request, task)) result.put("pendingRequestId", s(request, "id"));
        Route route = null;
        try { route = route(actor, owners, access.businessOwner(task)).forApplicant(actor.id()); }
        catch (ApiException ignored) { /* a broken chain is reported through the request route, not the list */ }
        result.put("route", routeView(actor, route));
        result.put("reviewerId", route == null ? null : route.reviewerId());
        Set<String> participantIds = new LinkedHashSet<>(owners);
        participantIds.add(s(task, "originalCreatorId"));
        participantIds.add(s(version, "createdBy"));
        participantIds.add(s(result, "reviewerId"));
        result.put("participants", participantSummaries(actor, participantIds));
        return result;
    }

    /** Display-only identities for a response whose task/request authorization has already passed. */
    private List<Map<String, Object>> participantSummaries(Actor actor, Collection<String> requestedIds) {
        Set<String> ids = new LinkedHashSet<>(requestedIds);
        ids.removeIf(id -> id == null || id.isBlank());
        if (ids.isEmpty()) return List.of();
        ReadBatch batch=currentBatch(actor);
        if(batch!=null) return ids.stream().sorted().map(batch.people::get).filter(Objects::nonNull)
                .map(person->Map.<String,Object>of("id",s(person,"id"),"displayName",s(person,"displayName"))).toList();
        List<Object> args = new ArrayList<>();
        args.add(actor.organizationId());
        args.addAll(ids);
        String placeholders = String.join(",", Collections.nCopies(ids.size(), "?"));
        return db.list("SELECT id,display_name FROM users WHERE organization_id=? AND id IN (" + placeholders + ") ORDER BY id", args.toArray())
                .stream().map(person -> Map.<String, Object>of("id", s(person, "id"), "displayName", s(person, "displayName"))).toList();
    }

    private Map<String, Object> snapshotView(Actor actor, Map<String, Object> version) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (String key : List.of("id", "taskId", "versionNo", "title", "description", "acceptanceCriteria", "priority", "allDay", "startAt", "dueAt", "startDate", "dueDate", "executionState", "progressNote", "status", "createdBy", "createdAt")) result.put(key, version.get(key));
        result.put("allDayCutoffTime", version.get("allDayCutoffTime") == null ? null : version.get("allDayCutoffTime").toString());
        result.put("assigneeIds", assignees(actor, s(version, "id")));
        // The live catalogue supplies the current name and colour; the stored snapshot is only a
        // fallback (and the immutable audit value) when the catalogue row is no longer readable.
        Map<String, Object> liveTag = readTag(actor,s(version,"tagId"));
        if (liveTag == null && s(version, "tagNameSnapshot") != null) {
            liveTag = new LinkedHashMap<>();
            liveTag.put("id", s(version, "tagId"));
            liveTag.put("name", s(version, "tagNameSnapshot"));
            liveTag.put("color", s(version, "tagColorSnapshot"));
            liveTag.put("border", "#8A8F98");
            liveTag.put("deleted", true);
        }
        result.put("tagId", s(version, "tagId"));
        result.put("tag", liveTag);
        String parent = s(version, "parentTaskId");
        boolean seeParent = parent == null || canSeeEffective(actor, parent);
        result.put("parentTaskId", seeParent ? parent : null);
        result.put("parentUnavailable", !seeParent);
        return result;
    }

    private boolean canSeeEffective(Actor actor, String id) {
        ReadBatch batch=currentBatch(actor);
        if(batch!=null && batch.completeVisibleTasks) {
            var task=batch.tasks.get(id);if(task==null) return false;
            var version=version(actor,s(task,"currentVersionId"));
            return access.canSeeTask(actor,task,version,assignees(actor,s(version,"id")));
        }
        Map<String, Object> task = db.find("SELECT * FROM tasks WHERE organization_id=? AND id=?", actor.organizationId(), id);
        if (task == null || s(task, "currentVersionId") == null) return false;
        Map<String, Object> v = version(actor, s(task, "currentVersionId"));
        return access.canSeeTask(actor, task, v, assignees(actor, s(v, "id")));
    }

    private void validateParent(Actor actor, String taskId, String parentId, boolean requireVisibility) {
        if (parentId == null) return;
        if (parentId.equals(taskId)) throw bad("任务不可作为自己的上级任务");
        if (requireVisibility && !canSeeEffective(actor, parentId)) throw bad("上级任务不存在或无权关联");
        Set<String> visited = new HashSet<>();
        String cursor = parentId;
        while (cursor != null) {
            if (cursor.equals(taskId) || !visited.add(cursor)) throw conflict("TASK_CYCLE", "上级任务关系不能形成循环");
            Map<String, Object> row = db.find("SELECT v.parent_task_id FROM tasks t JOIN task_versions v ON v.organization_id=t.organization_id AND v.id=t.current_version_id WHERE t.organization_id=? AND t.id=?", actor.organizationId(), cursor);
            cursor = row == null ? null : s(row, "parentTaskId");
        }
    }

    private boolean canSeeRequest(Actor actor, Map<String, Object> request, Map<String, Object> task) {
        if ("admin".equals(actor.role())) return false;
        return actor.id().equals(s(request, "applicantId")) || actor.id().equals(requestReviewer(actor, request, task));
    }

    private String requestReviewer(Actor actor, Map<String, Object> request, Map<String, Object> task) {
        if(!"pending".equals(s(request,"status"))) return reviewerOfRecord(request);
        Route route=currentRoute(actor,task,request);
        return route.blocked() || route.directFor(s(request,"applicantId"))?null:route.reviewerId();
    }

    private Route currentRoute(Actor actor,Map<String,Object> task,Map<String,Object> request) {
        if("create".equals(s(request,"kind"))) return creationRoute(actor,s(task,"originalCreatorId"));
        String versionId=s(task,"currentVersionId");
        if(versionId==null) return new Route(null,null,List.of(),"organization-tree",routeReasonText("organization-tree"),actor.authzVersion(),true,false);
        return route(actor,assignees(actor,versionId),access.businessOwner(task)).forApplicant(s(request,"applicantId"));
    }

    /**
     * The reviewer of record, read from the database. Reads never recompute a route silently, so what a
     * page shows is exactly what the decision path will enforce (DEV-010).
     */
    private String reviewerOfRecord(Map<String, Object> request) {
        return s(request, "currentReviewerId");
    }

    /** Non-creation review always belongs to the current task business owner. Assignee order is display-only. */
    public Route route(Actor context,List<String> owners,String businessOwnerId) {
        if(owners==null || owners.isEmpty()) throw bad("至少需要一位负责人");
        validateActiveOwners(context,owners);
        var owner=routePerson(context,businessOwnerId);
        if(businessOwnerId==null || owner==null || !availableForReview(owner))
            return new Route(null,businessOwnerId,List.of(),"business-owner-unavailable",
                    routeReasonText("business-owner-unavailable"),context.authzVersion(),true,false);
        return new Route(businessOwnerId,businessOwnerId,List.of(businessOwnerId),"business-owner",
                routeReasonText("business-owner"),context.authzVersion(),false,false);
    }

    /** Only the company's explicit fixed founder is exempt; all other creations use the direct manager. */
    public Route creationRoute(Actor context,String creatorId) {
        ReadBatch batch=currentBatch(context);
        CompanyTree.Tree tree=batch==null?companyTree.of(context.organizationId()):batch.tree;
        if(!tree.valid()) return Route.blocked(creatorId,"organization-tree",context.authzVersion());
        var creator=tree.nodes().get(creatorId);
        if(creator==null) return Route.blocked(creatorId,"creator-unavailable",context.authzVersion());
        if(creatorId.equals(tree.founderId())) return Route.exempt(creatorId,"founder-exempt",context.authzVersion());
        String managerId=s(creator,"managerId");
        var manager=managerId==null?null:tree.nodes().get(managerId);
        if(manager==null) return Route.blocked(creatorId,"manager-missing",context.authzVersion());
        if(!availableForReview(manager)) return Route.blocked(creatorId,"manager-unavailable",context.authzVersion());
        return new Route(managerId,creatorId,List.of(managerId),"direct-manager",routeReasonText("direct-manager"),
                context.authzVersion(),false,true);
    }

    private static boolean availableForReview(Map<String, Object> user) {
        Object value = user.get("reviewerAvailable");
        return value == null || Boolean.TRUE.equals(value) || value instanceof Number number && number.intValue() == 1;
    }

    /** Route projection for API responses; carries no proposal content. */
    private Map<String, Object> routeView(Actor actor, Route route) {
        Map<String, Object> view = new LinkedHashMap<>();
        if (route == null) return view;
        view.put("reviewerId", route.reviewerId());
        view.put("basisAssigneeId", route.basisAssigneeId());
        view.put("path", route.path());
        view.put("reason", route.reason());
        view.put("reasonText", routeReasonText(route.reason()));
        view.put("authzVersion", route.authzVersion());
        view.put("reviewerAvailable", route.hasReviewer());
        view.put("blocked", route.blocked());
        view.put("creation", route.creation());
        Set<String> ids = new LinkedHashSet<>();
        ids.add(route.reviewerId());
        ids.add(route.basisAssigneeId());
        view.put("participants", participantSummaries(actor, ids));
        return view;
    }

    /** The route exactly as persisted on a request; presentation text is derived from the stored code. */
    private Route storedRoute(Actor actor, Map<String, Object> request) {
        String reviewer = reviewerOfRecord(request);
        String reason = Objects.toString(request.get("routeReason"), reviewer == null ? "no-reviewer" : "manager-chain");
        long version = request.get("routeAuthzVersion") == null ? actor.authzVersion() : n(request, "routeAuthzVersion");
        return new Route(reviewer, s(request, "routeBasisAssigneeId"), List.of(), reason, routeReasonText(reason), version,
                "route-blocked".equals(reason) || reason.endsWith("-missing") || reason.endsWith("-inactive")
                        || reason.endsWith("-admin") || reason.endsWith("-unavailable") || "manager-cycle".equals(reason)
                        || "organization-tree".equals(reason),
                "create".equals(s(request, "kind")));
    }

    static String routeReasonText(String reason) {
        return switch (reason == null ? "" : reason) {
            case "manager-chain" -> "按最高组织层级负责人的管理链上溯";
            case "creator-fallback" -> "管理链无有效审核人，由可承接的原创建者审核";
            case "no-reviewer" -> "依据人管理链与原创建者均不可承接，记录原因后直接生效";
            case "direct-manager" -> "创建按创建人的直属上级审核";
            case "founder-exempt" -> "固定创始人创建，记录原因后直接生效";
            case "business-owner" -> "由任务当前业务责任方审核";
            case "self-reviewer" -> "申请人即当前业务责任方，记录原因后直接生效";
            case "applicant-unavailable" -> "原申请人已失去操作资格，申请被阻断，请办结或撤销";
            case "business-owner-unavailable" -> "任务当前业务责任方不可审核，请管理员安排合法接管";
            case "no-manager-exempt" -> "创建人确无直属上级，记录原因后免审生效";
            case "organization-tree" -> "员工组织树不唯一或上级引用损坏，无法确认创始人免审，请管理员修复组织关系";
            case "manager-missing" -> "已配置的直属上级账号不存在，创建审核被阻断，请管理员修复组织关系";
            case "manager-inactive" -> "已配置的直属上级账号已失效，创建审核被阻断，请管理员恢复或调整直属关系";
            case "manager-admin" -> "直属上级为独立管理员，不能审核业务创建，请管理员调整直属关系";
            case "manager-unavailable" -> "直属上级当前不可审核，创建审核被阻断，请管理员恢复其审核资格";
            case "manager-cycle" -> "直属上级关系存在循环，创建审核被阻断，请管理员修复组织关系";
            case "route-blocked" -> "创建审核路线不可用，请管理员修复组织关系";
            case "creator-missing" -> "创建人账号不存在，创建审核被阻断，请管理员修复组织关系";
            case "creator-unavailable" -> "创建人账号已失效或不具业务身份，创建审核被阻断，请管理员恢复账号";
            default -> Objects.toString(reason, "");
        };
    }

    /**
     * The reviewer chosen for one request: a creation rule, the ordered manager chain, a creator
     * fallback or a documented exemption. A blocked route carries no reviewer at all — it is never an
     * exemption, because the relationship exists but cannot be used.
     */
    public record Route(String reviewerId, String basisAssigneeId, List<String> path, String reason,
                        String reasonText, long authzVersion, boolean blocked, boolean creation) {
        public boolean hasReviewer() { return reviewerId != null && !blocked; }
        public boolean directFor(String applicantId) {return !blocked && (reviewerId==null || reviewerId.equals(applicantId));}
        Route forApplicant(String applicantId) {
            return !creation && directFor(applicantId) ? new Route(reviewerId,basisAssigneeId,path,"self-reviewer",
                    routeReasonText("self-reviewer"),authzVersion,false,false) : this;
        }

        /** A creation route that resolves to no reviewer on purpose (founder or provably no manager). */
        static Route exempt(String creatorId, String reason, long authzVersion) {
            return new Route(null, creatorId, List.of(), reason, routeReasonText(reason), authzVersion, false, true);
        }

        /** A creation route whose configured relationship cannot be used; never applied. */
        static Route blocked(String creatorId, String reason, long authzVersion) {
            return new Route(null, creatorId, List.of(), reason, routeReasonText(reason), authzVersion, true, true);
        }
    }

    private void validateAssignable(Actor actor, List<String> owners) {
        requireBusiness(actor);
        for (String id : owners) access.requireDispatchable(actor, id);
    }

    /** A creation assignee may be any active business member of the same company (chapter 3.1). */
    private void validateCreationAssignable(Actor actor, List<String> owners) {
        requireBusiness(actor);
        for (String id : owners) access.requireCreationCandidate(actor, id);
    }

    private void validateActiveOwners(Actor actor, List<String> owners) {
        for (String id : owners) {
            Map<String, Object> user = routePerson(actor, id);
            if (user == null || "admin".equals(s(user, "role"))) throw bad("管理员账号不能担任业务负责人");
        }
    }

    private Actor activeActor(Actor context, String id) {
        return access.actor(access.user(context, id));
    }

    private static void requireReopenSchedule(Map<String,Object> input) {
        if(!(input.get("allDay") instanceof Boolean allDay)) throw bad("重开须提交完整新排期，包括allDay");
        for(String field:allDay?List.of("startDate","dueDate"):List.of("startAt","dueAt"))
            if(!input.containsKey(field) || input.get(field)==null) throw bad("重开须提交完整新排期："+field);
    }

    private void validateRequestActor(Actor applicant, Map<String, Object> task, Map<String, Object> base, String kind) {
        if ("handover".equals(kind)) {
            // A handover is raised by the owner or their direct manager, so the applicant need not be an
            // assignee; validateHandoverAtApproval re-checks the dedicated authority instead.
            return;
        }
        if (Set.of("create", "change", "reopen").contains(kind)) {
            String responsible="create".equals(kind)?s(task,"originalCreatorId"):access.businessOwner(task);
            if (!applicant.id().equals(responsible)) throw conflict("APPLICANT_NO_LONGER_ALLOWED", "申请人已不具备该操作权限");
        } else if (base == null || !assignees(applicant, s(base, "id")).contains(applicant.id())) throw conflict("APPLICANT_NO_LONGER_ALLOWED", "申请人已不是当前负责人");
    }

    private Map<String, Object> validateForm(Actor actor, Map<String, Object> input, Map<String, Object> base) {
        Map<String, Object> values = new LinkedHashMap<>();
        if (base != null) for (String key : FORM) if (base.containsKey(key)) values.put(key, base.get(key));
        for (String key : FORM) if (input.containsKey(key)) values.put(key, input.get(key));
        values.put("title", requiredText(values, "title", 80));
        values.put("description", requiredText(values, "description", 5000));
        // The creation form no longer asks for a completion criterion (chapter 4.1). The value stays in
        // the snapshot so historical tasks keep displaying, editing and auditing it.
        values.put("acceptanceCriteria", optionalTextValue(values.get("acceptanceCriteria"), "acceptanceCriteria", 2000));
        Object priority = values.getOrDefault("priority", "medium");
        if (!(priority instanceof String) || !PRIORITIES.contains(priority)) throw bad("无效的紧急程度");
        values.put("priority", priority);
        if (input.containsKey("allDay") && !(input.get("allDay") instanceof Boolean)) throw bad("allDay须为布尔值");
        boolean allDay = bool(values.getOrDefault("allDay", false), "allDay");
        values.put("allDay", allDay);
        Instant start;
        Instant due;
        if (allDay) {
            LocalDate startDate = requiredDate(values.get("startDate"), "startDate");
            LocalDate dueDate = requiredDate(values.get("dueDate"), "dueDate");
            if (dueDate.isBefore(startDate)) throw bad("截止日期不得早于开始日期");
            ZoneId zone = organizationZone(actor);
            LocalTime cutoff = offWorkTime(actor);
            start = startDate.atStartOfDay(zone).toInstant();
            due = dueDate.atTime(cutoff).atZone(zone).toInstant();
            values.put("startDate", startDate.toString());
            values.put("dueDate", dueDate.toString());
            values.put("allDayCutoffTime", cutoff.toString());
        } else {
            start = instant(values.get("startAt"), "startAt");
            due = instant(values.get("dueAt"), "dueAt");
            if (due.isBefore(start)) throw bad("截止时间不得早于开始时间");
            values.put("startDate", null);
            values.put("dueDate", null);
            values.put("allDayCutoffTime", null);
        }
        values.put("startAt", start.toString());
        values.put("dueAt", due.toString());
        values.put("assigneeIds", ids(values.get("assigneeIds")));
        values.put("parentTaskId", optionalId(values.get("parentTaskId"), "parentTaskId"));
        // A task version holds at most one tag. The catalogue is resolved here, once, so the proposal,
        // the effective version and the audit snapshot all carry the same value.
        Object requestedTag = values.get("tagId");
        if (requestedTag != null && !(requestedTag instanceof String)) throw bad("tagId 必须为文字或空值");
        Map<String, Object> tag = tags.resolveForWrite(actor,
                requestedTag instanceof String text ? text.trim() : null, base == null ? null : s(base, "tagId"));
        values.put("tagId", tag == null ? null : s(tag, "id"));
        values.put("tagNameSnapshot", tag == null ? null : s(tag, "name"));
        values.put("tagColorSnapshot", tag == null ? null : s(tag, "color"));
        return values;
    }

    private Set<String> recipients(Map<String, Object> task, Map<String, Object> base, Map<String, Object> proposed, String applicant, String reviewer, boolean unpublished, boolean includeProposed) {
        Set<String> ids = new LinkedHashSet<>();
        ids.add(applicant);
        if (reviewer != null) ids.add(reviewer);
        if (!unpublished) {
            ids.add(access.businessOwner(task));
            String org = s(task, "organizationId");
            if (base != null) for (Map<String, Object> row : db.list("SELECT user_id FROM task_version_assignees WHERE organization_id=? AND version_id=?", org, s(base, "id"))) ids.add(s(row, "userId"));
            // Pending owner changes do not disclose the task to proposed assignees before they become effective.
            if (proposed != null && includeProposed) {
                for (Map<String, Object> row : db.list("SELECT user_id FROM task_version_assignees WHERE organization_id=? AND version_id=?", org, s(proposed, "id"))) ids.add(s(row, "userId"));
            }
        }
        ids.remove(null);
        return ids;
    }

    /** Batch state lives only inside one read transaction and is removed even when projection fails. */
    private static final class ReadBatch {
        final String organizationId;
        final CompanyTree.Tree tree;
        final Map<String,Map<String,Object>> tasks=new LinkedHashMap<>(),versions=new HashMap<>(),people=new HashMap<>(),tags=new HashMap<>();
        final Map<String,List<String>> owners=new HashMap<>();
        Map<String,Map<String,Object>> pending;
        final Map<String,Map<String,Object>> latestRequests=new LinkedHashMap<>();
        boolean completeVisibleTasks;
        ReadBatch(String organizationId,CompanyTree.Tree tree) {this.organizationId=organizationId;this.tree=tree;}
    }
    private ReadBatch baseReadBatch(Actor actor) {
        ReadBatch batch=new ReadBatch(actor.organizationId(),companyTree.of(actor.organizationId()));
        // Display-only participants may be inactive, but routes always use the active fixed tree.
        for(var row:db.list("SELECT id,display_name FROM users WHERE organization_id=? ORDER BY id",actor.organizationId()))
            batch.people.put(s(row,"id"),row);
        return batch;
    }
    private ReadBatch loadAdminBatch(Actor actor) {
        ReadBatch batch=baseReadBatch(actor);
        for(var row:db.list("SELECT * FROM tasks WHERE organization_id=? ORDER BY created_at DESC,id",actor.organizationId()))
            batch.tasks.put(s(row,"id"),row);
        for(var row:db.list("SELECT id,task_id,proposed_version_id,status,kind FROM approval_requests WHERE organization_id=? ORDER BY created_at,id",actor.organizationId()))
            batch.latestRequests.put(s(row,"taskId"),row);
        Set<String> versions=new LinkedHashSet<>();
        for(var task:batch.tasks.values()) {
            String current=s(task,"currentVersionId");var request=batch.latestRequests.get(s(task,"id"));
            versions.add(current!=null?current:request==null?null:s(request,"proposedVersionId"));
        }
        loadVersions(batch,versions);return batch;
    }
    private ReadBatch loadTaskBatch(Actor actor) {
        ReadBatch batch=baseReadBatch(actor);
        List<Object> args=new ArrayList<>();args.add(actor.organizationId());
        String visibility=candidateTaskVisibility(actor,batch.tree,args);
        for(var row:db.list("SELECT t.* FROM tasks t WHERE t.organization_id=? AND t.current_version_id IS NOT NULL AND ("
                +visibility+") ORDER BY t.created_at DESC,t.id",args.toArray())) batch.tasks.put(s(row,"id"),row);
        batch.completeVisibleTasks=true;
        loadCurrentVersions(batch);access.primeBusinessOwners(actor.organizationId(),batch.tasks.keySet());
        batch.pending=new HashMap<>();
        for(List<String> part:chunks(new ArrayList<>(batch.tasks.keySet()))) {
            List<Object> pendingArgs=new ArrayList<>();pendingArgs.add(actor.organizationId());pendingArgs.addAll(part);
            for(var row:db.list("SELECT * FROM approval_requests WHERE organization_id=? AND status='pending' AND task_id IN ("
                    +marks(part.size())+")",pendingArgs.toArray())) batch.pending.put(s(row,"taskId"),row);
        }
        return batch;
    }
    /** Same fixed-placement relationships as Access.canSeeTask, repeated in memory after the SQL prefilter. */
    private String candidateTaskVisibility(Actor actor,CompanyTree.Tree tree,List<Object> args) {
        if(!actor.business() || !Set.of("founder","department_head","team_head","employee").contains(actor.role())) return "1=0";
        if("founder".equals(actor.role())) return "1=1";
        args.add(actor.id());args.add(actor.id());args.add(actor.id());
        String visibility="t.original_creator_id=? OR EXISTS (SELECT 1 FROM task_version_assignees a WHERE a.organization_id=t.organization_id AND a.version_id=t.current_version_id AND a.user_id=?)"
                +" OR EXISTS (SELECT 1 FROM task_business_owners b WHERE b.organization_id=t.organization_id AND b.task_id=t.id AND b.employee_id=?)";
        String unit="department_head".equals(actor.role())?"department_id":"team_head".equals(actor.role())?"team_id":null;
        String unitId="department_id".equals(unit)?actor.departmentId():actor.teamId();
        if(unit!=null && unitId!=null && tree.valid()) {
            visibility+=" OR EXISTS (SELECT 1 FROM task_version_assignees a JOIN employee_placements ep ON ep.organization_id=a.organization_id AND ep.employee_id=a.user_id "
                    +"JOIN users u ON u.organization_id=ep.organization_id AND u.id=ep.employee_id JOIN principals pr ON pr.organization_id=u.organization_id AND pr.id=u.id "
                    +"WHERE a.organization_id=t.organization_id AND a.version_id=t.current_version_id AND u.active=1 AND pr.active=1 AND pr.account_type='employee' AND ep."+unit+"=?)";
            args.add(unitId);
        }
        return visibility;
    }
    private void loadTasks(ReadBatch batch,Collection<String> ids) {
        List<String> unique=ids.stream().filter(Objects::nonNull).distinct().filter(id->!batch.tasks.containsKey(id)).toList();
        for(List<String> part:chunks(unique)) {
            List<Object> args=new ArrayList<>();args.add(batch.organizationId);args.addAll(part);
            for(var row:db.list("SELECT * FROM tasks WHERE organization_id=? AND id IN ("+marks(part.size())+")",args.toArray()))
                batch.tasks.put(s(row,"id"),row);
        }
    }
    private void loadCurrentVersions(ReadBatch batch) {
        Set<String> ids=new LinkedHashSet<>();batch.tasks.values().forEach(task->ids.add(s(task,"currentVersionId")));
        loadVersions(batch,ids);
    }
    private void loadVersions(ReadBatch batch,Collection<String> ids) {
        List<String> missing=ids.stream().filter(Objects::nonNull).distinct().filter(id->!batch.versions.containsKey(id)).toList();
        for(List<String> part:chunks(missing)) {
            List<Object> args=new ArrayList<>();args.add(batch.organizationId);args.addAll(part);
            String placeholders=marks(part.size());
            for(var row:db.list("SELECT * FROM task_versions WHERE organization_id=? AND id IN ("+placeholders+")",args.toArray()))
                batch.versions.put(s(row,"id"),row);
            for(var row:db.list("SELECT version_id,user_id FROM task_version_assignees WHERE organization_id=? AND version_id IN ("
                    +placeholders+") ORDER BY version_id,ordinal,user_id",args.toArray()))
                batch.owners.computeIfAbsent(s(row,"versionId"),ignored->new ArrayList<>()).add(s(row,"userId"));
        }
    }
    private static List<List<String>> chunks(List<String> ids) {
        List<List<String>> result=new ArrayList<>();
        for(int start=0;start<ids.size();start+=500) result.add(ids.subList(start,Math.min(start+500,ids.size())));
        return result;
    }
    private static String marks(int size) {return String.join(",",Collections.nCopies(size,"?"));}
    private <T> T withReadBatch(ReadBatch batch,Supplier<T> work) {
        ReadBatch previous=batchReads.get();batchReads.set(batch);
        try {return work.get();}
        finally {if(previous==null) batchReads.remove();else batchReads.set(previous);}
    }
    private ReadBatch currentBatch(Actor actor) {
        ReadBatch batch=batchReads.get();return batch!=null && batch.organizationId.equals(actor.organizationId())?batch:null;
    }
    private Map<String,Object> routePerson(Actor actor,String id) {
        ReadBatch batch=currentBatch(actor);
        return batch==null?access.activeUser(actor,id):batch.tree.valid()?batch.tree.nodes().get(id):null;
    }
    private Map<String,Object> readTag(Actor actor,String id) {
        ReadBatch batch=currentBatch(actor);if(batch==null || id==null) return tags.view(actor,id);
        if(!batch.tags.containsKey(id)) batch.tags.put(id,tags.view(actor,id));
        return batch.tags.get(id);
    }

    private Map<String, Object> task(Actor actor, String id, boolean lock) {
        requiredId(id, "taskId");
        ReadBatch batch=currentBatch(actor);if(!lock && batch!=null && batch.tasks.containsKey(id)) return batch.tasks.get(id);
        return db.one("SELECT * FROM tasks WHERE organization_id=? AND id=?" + (lock ? " FOR UPDATE" : ""), actor.organizationId(), id);
    }

    private Map<String, Object> version(Actor actor, String id) {
        ReadBatch batch=currentBatch(actor);if(batch!=null && batch.versions.containsKey(id)) return batch.versions.get(id);
        return db.one("SELECT * FROM task_versions WHERE organization_id=? AND id=?", actor.organizationId(), id);
    }

    private Map<String, Object> request(Actor actor, String id, boolean lock) {
        requiredId(id, "requestId");
        return db.one("SELECT * FROM approval_requests WHERE organization_id=? AND id=?" + (lock ? " FOR UPDATE" : ""), actor.organizationId(), id);
    }

    private Map<String, Object> pending(Actor actor, String taskId, boolean lock) {
        ReadBatch batch=currentBatch(actor);if(!lock && batch!=null && batch.pending!=null) return batch.pending.get(taskId);
        return db.find("SELECT * FROM approval_requests WHERE organization_id=? AND task_id=? AND status='pending'" + (lock ? " FOR UPDATE" : ""), actor.organizationId(), taskId);
    }

    private List<String> assignees(Actor actor, String versionId) {
        ReadBatch batch=currentBatch(actor);if(batch!=null && batch.versions.containsKey(versionId)) return batch.owners.getOrDefault(versionId,List.of());
        // Saved submission order drives reviewer routing (DEV-006); legacy rows keep the deterministic
        // compatibility order with order_source='legacy-order-unknown'.
        return db.list("SELECT user_id FROM task_version_assignees WHERE organization_id=? AND version_id=? ORDER BY ordinal,user_id", actor.organizationId(), versionId).stream().map(row -> s(row, "userId")).toList();
    }

    private ZoneId organizationZone(Actor actor) {
        String zone = s(db.one("SELECT time_zone FROM organizations WHERE id=?", actor.organizationId()), "timeZone");
        try { return ZoneId.of(zone); } catch (RuntimeException e) { throw conflict("INVALID_ORGANIZATION_ZONE", "组织时区配置无效"); }
    }

    private static Map<String, Object> result(String taskId, String requestId, String outcome, long version) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("taskId", taskId);
        result.put("requestId", requestId);
        result.put("outcome", outcome);
        result.put("rowVersion", version);
        return result;
    }

    static String command(Map<String, Object> input, String key, String alias, String fallback) {
        Object primary = input.get(key);
        Object alternative = input.get(alias);
        if (input.containsKey(key) && !(primary instanceof String) || input.containsKey(alias) && !(alternative instanceof String)) throw bad("动作必须为字符串");
        if (primary != null && alternative != null && !primary.equals(alternative)) throw bad("动作参数不一致");
        return primary != null ? (String) primary : alternative != null ? (String) alternative : fallback;
    }

    static String requiredText(Map<String, Object> values, String key, int max) {
        Object value = values.get(key);
        if (!(value instanceof String)) throw bad(key + "为必填文本");
        String text = ((String) value).strip();
        if (text.isEmpty() || text.codePointCount(0, text.length()) > max) throw bad(key + "长度须为1至" + max + "字");
        if (text.indexOf('\0') >= 0) throw bad(key + "含无效字符");
        return text;
    }

    /** Rule 4.1: a creation must not smuggle back a completion criterion. */
    private static void rejectCreationCriteria(Map<String, Object> input) {
        if (!input.containsKey("acceptanceCriteria")) return;
        Object raw = input.get("acceptanceCriteria");
        if (raw == null) return;
        if (!(raw instanceof String text)) throw bad("acceptanceCriteria为文字");
        if (!text.isBlank()) throw bad("创建任务不再填写完成标准；历史任务的完成标准仍可保留和编辑");
    }

    /** Empty or absent text is a valid value here (completion criteria are optional). */
    static String optionalTextValue(Object value, String key, int max) {
        if (value == null) return "";
        if (!(value instanceof String text)) throw bad(key + "为文字");
        String stripped = text.strip();
        if (stripped.codePointCount(0, stripped.length()) > max) throw bad(key + "长度须为0至" + max + "字");
        if (stripped.indexOf('\0') >= 0) throw bad(key + "含无效字符");
        return stripped;
    }

    private static String optionalText(Map<String, Object> input, String key, int max) {
        if (!input.containsKey(key) || input.get(key) == null) return null;
        return requiredText(input, key, max);
    }

    static List<String> ids(Object value) {
        if (!(value instanceof List<?> list) || list.isEmpty() || list.size() > 100) throw bad("负责人须为1至100个账号");
        List<String> result = new ArrayList<>();
        for (Object id : list) result.add(requiredId(id, "assigneeIds"));
        if (new HashSet<>(result).size() != result.size()) throw bad("负责人不能重复");
        return result;
    }

    private static String optionalId(Object value, String key) {
        return value == null ? null : requiredId(value, key);
    }

    static String requiredId(Object value, String key) {
        if (!(value instanceof String text) || !text.matches("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")) throw bad(key + "须为有效UUID");
        return ((String) value).toLowerCase(Locale.ROOT);
    }

    static Instant instant(Object value, String key) {
        if (value instanceof Timestamp timestamp) return timestamp.toInstant();
        if (value instanceof Instant time) return time;
        if (!(value instanceof String text)) throw bad(key + "为必填带时区日期时间");
        try {
            Instant result = OffsetDateTime.parse(text).toInstant();
            int year = result.atOffset(ZoneOffset.UTC).getYear();
            if (year < 1000 || year > 9998) throw bad(key + "超出支持的日期范围");
            return result.truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        } catch (DateTimeParseException e) { throw bad(key + "须为带时区的ISO日期时间"); }
    }

    private static LocalDate optionalDate(Object value, String key) { return value == null ? null : requiredDate(value, key); }

    static LocalDate requiredDate(Object value, String key) {
        if (!(value instanceof String text)) throw bad(key + "为必填日期");
        try {
            LocalDate date = LocalDate.parse(text);
            if (date.getYear() < 1000 || date.getYear() > 9998) throw bad(key + "超出支持的日期范围");
            return date;
        } catch (DateTimeParseException e) { throw bad(key + "须为YYYY-MM-DD日期"); }
    }

    static boolean bool(Object value, String key) {
        if (value instanceof Boolean b) return b;
        if (value instanceof Number n && (n.intValue() == 0 || n.intValue() == 1)) return n.intValue() == 1;
        throw bad(key + "须为布尔值");
    }

    private static boolean active(Map<String, Object> user) {
        Object value = user.get("active");
        return Boolean.TRUE.equals(value) || value instanceof Number number && number.intValue() == 1;
    }

    static void allowed(Map<String, Object> input, Set<String> keys) {
        for (String key : input.keySet()) if (!keys.contains(key)) throw bad("不支持的字段：" + key);
    }

    private static Set<String> union(Set<String> base, String... extras) {
        Set<String> result = new HashSet<>(base);
        result.addAll(Arrays.asList(extras));
        return result;
    }

    private static int integer(String raw, int fallback, int min, int max, String name) {
        if (raw == null) return fallback;
        try {
            int number = Integer.parseInt(raw);
            if (number < min || number > max) throw bad(name + "超出范围");
            return number;
        } catch (NumberFormatException e) { throw bad(name + "须为整数"); }
    }

    private void requireBusiness(Actor actor) {
        if (!actor.business()) throw forbidden("管理员不参与普通业务操作");
        access.requireCurrent(actor);
    }

    private LocalTime offWorkTime(Actor actor) {
        Map<String, Object> organization = db.one("SELECT off_work_time FROM organizations WHERE id=?", actor.organizationId());
        Object value = organization.get("offWorkTime");
        if (value instanceof Time time) return time.toLocalTime();
        if (value instanceof LocalTime time) return time;
        if (value instanceof String text && !text.isBlank()) {
            try {
                return LocalTime.parse(text);
            } catch (DateTimeParseException exception) {
                throw conflict("INVALID_ORGANIZATION_CUTOFF", "公司全天截止时刻配置无效");
            }
        }
        return DEFAULT_ALL_DAY_CUTOFF;
    }

    private static Time cutoffTime(Object value) {
        if (value == null) return null;
        if (value instanceof Time time) return time;
        if (value instanceof LocalTime time) return Time.valueOf(time);
        String text = value.toString();
        if (text.isBlank()) return null;
        try {
            return Time.valueOf(LocalTime.parse(text));
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private static boolean hasScheduleInput(Map<String, Object> input) {
        return SCHEDULE_FIELDS.stream().anyMatch(input::containsKey);
    }

    private Timestamp now() { return Timestamp.from(clock.instant()); }
    private static ApiException bad(String message) { return new ApiException(400, "INVALID_INPUT", message); }
    private static ApiException forbidden(String message) { return new ApiException(403, "FORBIDDEN", message); }
    private static ApiException conflict(String code, String message) { return new ApiException(409, code, message); }
}
