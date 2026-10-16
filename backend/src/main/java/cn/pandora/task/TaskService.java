package cn.pandora.task;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import cn.pandora.common.Events;
import cn.pandora.common.Writes;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.*;
import java.time.format.DateTimeParseException;
import java.util.*;

import static cn.pandora.common.Db.s;
import static cn.pandora.common.Db.n;

/** Task snapshots and approval commands. Writes.run owns the enclosing transaction/organization lock. */
@Service
public class TaskService {
    private static final Set<String> FORM = Set.of("title", "description", "acceptanceCriteria", "priority", "allDay",
            "startAt", "dueAt", "startDate", "dueDate", "assigneeIds", "parentTaskId");
    private static final Set<String> STATES = Set.of("todo", "doing", "done");
    private static final Set<String> PRIORITIES = Set.of("urgent", "high", "medium", "low");
    // Local V1 policy: all-day tasks are due at 18:00 in the organization's time zone.
    private static final LocalTime ALL_DAY_CUTOFF = LocalTime.of(18, 0);
    private final Db db;
    private final Access access;
    private final Events events;

    public TaskService(Db db, Access access, Events events) {
        this.db = db;
        this.access = access;
        this.events = events;
    }

    public Map<String, Object> list(Actor actor, Map<String, String> filters) {
        int limit = integer(filters.get("limit"), 50, 1, 100, "limit");
        int offset = integer(filters.get("offset"), 0, 0, Integer.MAX_VALUE, "offset");
        String state = filters.get("state");
        String priority = filters.get("priority");
        if (state != null && !STATES.contains(state)) throw bad("无效的任务状态");
        if (priority != null && !PRIORITIES.contains(priority)) throw bad("无效的紧急程度");
        String assignee = optionalId(filters.get("assigneeId"), "assigneeId");
        String creator = optionalId(filters.get("creatorId"), "creatorId");
        String query = filters.getOrDefault("q", "").trim();
        if (query.length() > 200) throw bad("搜索内容最多200字");
        LocalDate from = optionalDate(filters.get("from"), "from");
        LocalDate to = optionalDate(filters.get("to"), "to");
        if (from != null && to != null && to.isBefore(from)) throw bad("结束日期不得早于开始日期");
        ZoneId zone = organizationZone(actor);
        List<Map<String, Object>> visible = new ArrayList<>();
        for (Map<String, Object> task : db.list("SELECT * FROM tasks WHERE organization_id=? AND current_version_id IS NOT NULL ORDER BY created_at DESC,id", actor.organizationId())) {
            Map<String, Object> version = version(actor, s(task, "currentVersionId"));
            List<String> owners = assignees(actor, s(version, "id"));
            if (!access.canSeeTask(actor, task, version, owners)) continue;
            if (state != null && !state.equals(s(task, "executionState"))) continue;
            if (priority != null && !priority.equals(s(version, "priority"))) continue;
            if (assignee != null && !owners.contains(assignee)) continue;
            if (creator != null && !creator.equals(s(task, "originalCreatorId"))) continue;
            if (!query.isEmpty() && !s(version, "title").toLowerCase(Locale.ROOT).contains(query.toLowerCase(Locale.ROOT))) continue;
            LocalDate start = instant(version.get("startAt"), "startAt").atZone(zone).toLocalDate();
            LocalDate due = instant(version.get("dueAt"), "dueAt").atZone(zone).toLocalDate();
            if (from != null && due.isBefore(from) || to != null && start.isAfter(to)) continue;
            visible.add(taskView(actor, task, version, owners));
        }
        int begin = Math.min(offset, visible.size());
        int end = (int) Math.min((long) begin + limit, visible.size());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", visible.subList(begin, end));
        result.put("total", visible.size());
        result.put("nextCursor", end < visible.size() ? Integer.toString(end) : null);
        return result;
    }

    /**
     * Assignee candidates come from the dispatch range only (DEV-002). The list is deliberately
     * narrower than what the actor may view: seeing a department's tasks never offers its people.
     */
    public Map<String, Object> assigneeCandidates(Actor actor, String query) {
        requireBusiness(actor);
        if (query != null && query.length() > 100) throw bad("搜索内容最多100字");
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> person : access.dispatchCandidates(actor, query)) {
            Map<String, Object> item = new LinkedHashMap<>();
            for (String key : List.of("id", "username", "displayName", "departmentId", "departmentName",
                    "positionId", "positionName", "teamId", "rankLevel")) {
                item.put(key, person.get(key));
            }
            items.add(item);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("empty", items.isEmpty());
        return result;
    }

    public Map<String, Object> detail(Actor actor, String id) {        Map<String, Object> task = task(actor, id, false);
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
            result.put("reviewerId", requestReviewer(actor, request, task));
            Set<String> participantIds = new LinkedHashSet<>(assignees(actor, s(proposed, "id")));
            participantIds.add(s(task, "originalCreatorId"));
            participantIds.add(s(request, "applicantId"));
            participantIds.add(s(proposed, "createdBy"));
            participantIds.add(s(result, "reviewerId"));
            result.put("participants", participantSummaries(actor, participantIds));
            return result;
        }
        Map<String, Object> version = version(actor, current);
        List<String> owners = assignees(actor, current);
        if (!access.canSeeTask(actor, task, version, owners)) throw ApiException.notFound();
        Map<String, Object> result = taskView(actor, task, version, owners);
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
        Map<String, Object> proposed = validateForm(actor, input, null);
        List<String> owners = ids(proposed.get("assigneeIds"));
        validateAssignable(actor, owners);
        String id = Db.id();
        validateParent(actor, id, s(proposed, "parentTaskId"), true);
        String reviewer = reviewer(actor, owners, actor.id());
        Timestamp now = now();
        db.update("INSERT INTO tasks(id,organization_id,original_creator_id,current_version_id,execution_state,row_version,execution_round,due_version,created_at,updated_at) VALUES(?,?,?,NULL,'todo',1,1,1,?,?)", id, actor.organizationId(), actor.id(), now, now);
        Map<String, Object> task = task(actor, id, true);
        proposed.put("executionState", "todo");
        proposed.put("progressNote", "");
        return submit(actor, task, null, proposed, owners, reviewer, "create", null);
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
        if (current == null ? !creator : !access.canSeeTask(actor, task, current, currentOwners)) throw ApiException.notFound();
        Writes.checkVersion(ifMatch, n(task, "rowVersion"));
        if (pending(actor, id, true) != null) throw conflict("TASK_FROZEN", "任务有待审核申请，请先处理或撤销");
        Map<String, Object> proposed;
        List<String> proposedOwners;
        String body = null;
        if (current == null) {
            if (!creator || !Set.of("create", "change").contains(command)) throw forbidden("未发布任务仅创建者可编辑重提");
            allowed(input, union(FORM, "command", "action", "reason"));
            Map<String, Object> previous = db.one("SELECT * FROM task_versions WHERE organization_id=? AND task_id=? ORDER BY version_no DESC LIMIT 1", actor.organizationId(), id);
            previous = new LinkedHashMap<>(previous);
            previous.put("assigneeIds", assignees(actor, s(previous, "id")));
            proposed = validateForm(actor, input, previous);
            proposed.put("executionState", "todo");
            proposed.put("progressNote", "");
            command = "create";
            if (input.containsKey("reason")) body = requiredText(input, "reason", 500);
        } else if ("change".equals(command)) {
            if (!creator) throw forbidden("仅原创建者可修改任务资料");
            if ("done".equals(s(task, "executionState"))) throw conflict("TASK_COMPLETED", "已完成任务须先重开");
            allowed(input, union(FORM, "command", "action", "reason"));
            body = requiredText(input, "reason", 500);
            if (FORM.stream().noneMatch(input::containsKey)) throw bad("请提供需要修改的任务字段");
            Map<String, Object> base = new LinkedHashMap<>(current);
            base.put("assigneeIds", currentOwners);
            proposed = validateForm(actor, input, base);
            proposed.put("executionState", s(current, "executionState"));
            proposed.put("progressNote", current.get("progressNote"));
        } else {
            if ("create".equals(command)) throw bad("已发布任务不可再次创建");
            proposed = new LinkedHashMap<>(current);
            proposed.put("assigneeIds", currentOwners);
            if ("reopen".equals(command)) {
                allowed(input, Set.of("command", "action", "reason"));
                if (!creator) throw forbidden("仅原创建者可重开任务");
                if (!"done".equals(s(task, "executionState"))) throw conflict("INVALID_TASK_STATE", "仅已完成任务可重开");
                body = requiredText(input, "reason", 500);
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
        if (current == null || "change".equals(command)) validateAssignable(actor, proposedOwners);
        else validateActiveOwners(actor, proposedOwners);
        validateParent(actor, id, s(proposed, "parentTaskId"), current == null || !Objects.equals(s(current, "parentTaskId"), s(proposed, "parentTaskId")));
        // Current assignees determine this request's route; proposed assignees only apply after approval.
        String reviewer = reviewer(actor, current == null ? proposedOwners : currentOwners, s(task, "originalCreatorId"));
        return submit(actor, task, current, proposed, proposedOwners, reviewer, command, body);
    }

    public Map<String, Object> approvals(Actor actor, String mine) {
        return approvals(actor, mine, null, null);
    }

    public Map<String, Object> approvals(Actor actor, String mine, String requestedLimit, String requestedOffset) {
        int limit = integer(requestedLimit, 50, 1, 100, "limit");
        int offset = integer(requestedOffset, 0, 0, Integer.MAX_VALUE, "offset");
        if (mine == null || mine.isBlank()) mine = "all";
        if ("submitted".equals(mine)) mine = "applicant";
        if ("reviewing".equals(mine)) mine = "reviewer";
        if (!Set.of("all", "reviewer", "applicant").contains(mine)) throw bad("mine须为all、reviewer或applicant");
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> request : db.list("SELECT * FROM approval_requests WHERE organization_id=? ORDER BY created_at DESC,id", actor.organizationId())) {
            Map<String, Object> task = task(actor, s(request, "taskId"), false);
            if (!canSeeRequest(actor, request, task)) continue;
            boolean applicant = actor.id().equals(s(request, "applicantId"));
            String reviewer = requestReviewer(actor, request, task);
            if ("applicant".equals(mine) && !applicant || "reviewer".equals(mine) && !actor.id().equals(reviewer)) continue;
            Map<String, Object> item = new LinkedHashMap<>(request);
            item.put("requestId", s(request, "id"));
            item.put("currentReviewerId", reviewer);
            item.put("title", s(version(actor, s(request, "proposedVersionId")), "title"));
            item.put("participants", participantSummaries(actor, Arrays.asList(s(request, "applicantId"), reviewer)));
            result.add(item);
        }
        int begin = Math.min(offset, result.size());
        int end = (int) Math.min((long) begin + limit, result.size());
        Map<String, Object> page = new LinkedHashMap<>();
        page.put("items", result.subList(begin, end));
        page.put("total", result.size());
        page.put("nextCursor", end < result.size() ? Integer.toString(end) : null);
        return page;
    }

    public Map<String, Object> approval(Actor actor, String id) {
        Map<String, Object> request = request(actor, id, false);
        Map<String, Object> task = task(actor, s(request, "taskId"), false);
        if (!canSeeRequest(actor, request, task)) throw ApiException.notFound();
        Map<String, Object> result = new LinkedHashMap<>(request);
        result.put("requestId", id);
        result.put("currentReviewerId", requestReviewer(actor, request, task));
        Map<String, Object> proposed = version(actor, s(request, "proposedVersionId"));
        Map<String, Object> base = s(request, "baseVersionId") == null ? null : version(actor, s(request, "baseVersionId"));
        result.put("proposedVersion", snapshotView(actor, proposed));
        result.put("baseVersion", base == null ? null : snapshotView(actor, base));
        result.put("records", db.list("SELECT id,author_id,body,kind,effective_at,created_at FROM task_records WHERE organization_id=? AND request_id=? ORDER BY created_at,id", actor.organizationId(), id));
        Set<String> participantIds = new LinkedHashSet<>(assignees(actor, s(proposed, "id")));
        if (base != null) {
            participantIds.addAll(assignees(actor, s(base, "id")));
            participantIds.add(s(base, "createdBy"));
        }
        participantIds.add(s(proposed, "createdBy"));
        participantIds.add(s(task, "originalCreatorId"));
        participantIds.add(s(request, "applicantId"));
        participantIds.add(s(result, "currentReviewerId"));
        result.put("participants", participantSummaries(actor, participantIds));
        return result;
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
        if (!"pending".equals(s(request, "status"))) throw conflict("REQUEST_RESOLVED", "该申请已处理，请刷新");
        String reviewer = requestReviewer(actor, request, task);
        if ("withdraw".equals(decision)) {
            if (!actor.id().equals(s(request, "applicantId"))) throw forbidden("仅申请人可撤销申请");
        } else {
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
            validateActiveOwners(actor, newOwners);
            Actor applicant = activeActor(actor, s(request, "applicantId"));
            if (Set.of("create", "change").contains(kind)) validateAssignable(applicant, newOwners);
            validateParent(applicant, taskId, s(proposed, "parentTaskId"), base == null || !Objects.equals(s(base, "parentTaskId"), s(proposed, "parentTaskId")));
            validateRequestActor(applicant, task, base, kind);
        }
        int changed = db.update("UPDATE approval_requests SET status=?,comment=?,current_reviewer_id=?,decided_at=?,decided_by=?,row_version=row_version+1 WHERE organization_id=? AND id=? AND status='pending' AND row_version=?", status, comment, reviewer == null ? s(request, "currentReviewerId") : reviewer, now, actor.id(), actor.organizationId(), id, n(request, "rowVersion"));
        if (changed != 1) throw conflict("REQUEST_RESOLVED", "该申请已处理，请刷新");
        db.update("UPDATE task_versions SET status=? WHERE organization_id=? AND id=? AND status='proposed'", "approve".equals(decision) ? "applied" : status, actor.organizationId(), s(proposed, "id"));
        if ("approve".equals(decision)) {
            applyVersion(actor, task, base, proposed, kind);
            db.update("UPDATE task_records SET effective_at=? WHERE organization_id=? AND request_id=?", now, actor.organizationId(), id);
        } else if ("reject".equals(decision) && "complete".equals(kind)) {
            // A completion rejection always leaves an effective doing snapshot, even when completion began at todo.
            Map<String, Object> returned = new LinkedHashMap<>(Objects.requireNonNull(base));
            returned.put("executionState", "doing");
            String newVersion = insertVersion(actor, taskId, returned, assignees(actor, baseId), "applied");
            returned.put("id", newVersion);
            applyVersion(actor, task, base, returned, "return");
            insertRecord(actor, taskId, id, comment, "return", true);
        } else {
            db.update("UPDATE tasks SET row_version=row_version+1,updated_at=? WHERE organization_id=? AND id=?", now, actor.organizationId(), taskId);
        }
        Set<String> recipients = recipients(task, base, proposed, s(request, "applicantId"), reviewer, "create".equals(kind) && !"approve".equals(decision), "approve".equals(decision));
        events.record(actor, taskId, "task." + kind + "." + status, recipients, Map.of("requestId", id, "kind", kind, "status", status));
        Map<String, Object> updated = task(actor, taskId, false);
        Map<String, Object> result = result(taskId, id, status, n(updated, "rowVersion"));
        result.put("requestRowVersion", n(request, "rowVersion") + 1);
        return result;
    }

    private Map<String, Object> submit(Actor actor, Map<String, Object> task, Map<String, Object> base, Map<String, Object> proposed, List<String> owners, String reviewer, String kind, String body) {
        String taskId = s(task, "id");
        boolean direct = actor.id().equals(s(task, "originalCreatorId")) && actor.id().equals(reviewer);
        String versionId = insertVersion(actor, taskId, proposed, owners, direct ? "applied" : "proposed");
        proposed.put("id", versionId);
        String requestId = Db.id();
        Timestamp now = now();
        db.update("INSERT INTO approval_requests(id,organization_id,task_id,proposed_version_id,applicant_id,current_reviewer_id,kind,status,comment,base_version_id,previous_state,row_version,created_at,decided_at,decided_by,exemption_reason) VALUES(?,?,?,?,?,?,?,?,NULL,?,?,1,?,?,NULL,?)",
                requestId, actor.organizationId(), taskId, versionId, actor.id(), reviewer, kind, direct ? "direct" : "pending", base == null ? null : s(base, "id"), s(task, "executionState"), now, direct ? now : null, direct ? "操作人为原创建者且等于当前审核人" : null);
        if (body != null) insertRecord(actor, taskId, requestId, body, kind, direct);
        if (direct) applyVersion(actor, task, base, proposed, kind);
        else if (base != null || n(task, "rowVersion") > 1) {
            db.update("UPDATE tasks SET row_version=row_version+1,updated_at=? WHERE organization_id=? AND id=?", now, actor.organizationId(), taskId);
        }
        events.record(actor, taskId, "task." + kind + "." + (direct ? "applied" : "submitted"), recipients(task, base, proposed, actor.id(), reviewer, base == null && !direct, direct), Map.of("requestId", requestId, "kind", kind, "status", direct ? "direct" : "pending"));
        return result(taskId, requestId, direct ? "direct" : "pending", n(task(actor, taskId, false), "rowVersion"));
    }

    private void applyVersion(Actor actor, Map<String, Object> task, Map<String, Object> base, Map<String, Object> proposed, String kind) {
        boolean dueChanged = base != null && !instant(base.get("dueAt"), "dueAt").equals(instant(proposed.get("dueAt"), "dueAt"));
        db.update("UPDATE tasks SET current_version_id=?,execution_state=?,row_version=row_version+1,execution_round=execution_round+?,due_version=due_version+?,updated_at=? WHERE organization_id=? AND id=?",
                s(proposed, "id"), s(proposed, "executionState"), "reopen".equals(kind) ? 1 : 0, dueChanged ? 1 : 0, now(), actor.organizationId(), s(task, "id"));
    }

    private String insertVersion(Actor actor, String taskId, Map<String, Object> values, List<String> owners, String status) {
        String id = Db.id();
        db.update("INSERT INTO task_versions(id,organization_id,task_id,version_no,title,description,acceptance_criteria,priority,all_day,start_at,due_at,start_date,due_date,execution_state,progress_note,parent_task_id,status,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                id, actor.organizationId(), taskId, nextVersionNumber(actor, taskId), values.get("title"), values.get("description"), values.get("acceptanceCriteria"), values.get("priority"), bool(values.get("allDay"), "allDay"), Timestamp.from(instant(values.get("startAt"), "startAt")), Timestamp.from(instant(values.get("dueAt"), "dueAt")), values.get("startDate"), values.get("dueDate"), values.get("executionState"), values.get("progressNote"), values.get("parentTaskId"), status, actor.id(), now());
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
        result.put("rowVersion", n(task, "rowVersion"));
        result.put("executionRound", n(task, "executionRound"));
        result.put("dueVersion", n(task, "dueVersion"));
        result.put("published", true);
        result.put("createdAt", task.get("createdAt"));
        result.put("updatedAt", task.get("updatedAt"));
        Map<String, Object> request = pending(actor, s(task, "id"), false);
        result.put("pending", request != null);
        result.put("frozen", request != null);
        if (request != null && canSeeRequest(actor, request, task)) result.put("pendingRequestId", s(request, "id"));
        try { result.put("reviewerId", reviewer(actor, owners, s(task, "originalCreatorId"))); }
        catch (ApiException ignored) { result.put("reviewerId", null); }
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
        result.put("assigneeIds", assignees(actor, s(version, "id")));
        String parent = s(version, "parentTaskId");
        boolean seeParent = parent == null || canSeeEffective(actor, parent);
        result.put("parentTaskId", seeParent ? parent : null);
        result.put("parentUnavailable", !seeParent);
        return result;
    }

    private boolean canSeeEffective(Actor actor, String id) {
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
        if (!"pending".equals(s(request, "status"))) return s(request, "currentReviewerId");
        String routeVersion = s(request, "baseVersionId") == null ? s(request, "proposedVersionId") : s(request, "baseVersionId");
        try { return reviewer(actor, assignees(actor, routeVersion), s(task, "originalCreatorId")); }
        catch (ApiException ignored) { return null; }
    }

    private String reviewer(Actor actor, List<String> owners, String creator) {
        List<Map<String, Object>> people = new ArrayList<>();
        for (String id : owners) {
            Map<String, Object> person = db.find("SELECT * FROM users WHERE organization_id=? AND id=?", actor.organizationId(), id);
            if (person == null) throw conflict("ROUTE_BLOCKED", "负责人组织关系不完整");
            people.add(person);
        }
        if (people.isEmpty()) throw bad("至少需要一位负责人");
        long highest = people.stream().mapToLong(p -> n(p, "rankLevel")).min().orElseThrow();
        List<List<String>> paths = new ArrayList<>();
        for (Map<String, Object> person : people) if (n(person, "rankLevel") == highest) paths.add(managerPath(actor, person));
        for (String candidate : paths.getFirst()) if (paths.stream().allMatch(path -> path.contains(candidate))) return candidate;
        Map<String, Object> fallback = db.find("SELECT * FROM users WHERE organization_id=? AND id=?", actor.organizationId(), creator);
        if (fallback != null && active(fallback) && !"admin".equals(s(fallback, "role"))) return creator;
        throw conflict("ROUTE_BLOCKED", "无可用审核人，请联系管理员处理组织关系");
    }

    private List<String> managerPath(Actor actor, Map<String, Object> person) {
        List<String> path = new ArrayList<>();
        Set<String> visited = new HashSet<>();
        visited.add(s(person, "id"));
        String id = s(person, "managerId");
        long rank = n(person, "rankLevel");
        while (id != null) {
            if (!visited.add(id)) throw conflict("ROUTE_BLOCKED", "组织管理关系存在循环");
            Map<String, Object> manager = db.find("SELECT * FROM users WHERE organization_id=? AND id=?", actor.organizationId(), id);
            if (manager == null) break;
            if (active(manager) && !"admin".equals(s(manager, "role")) && n(manager, "rankLevel") < rank) path.add(id);
            id = s(manager, "managerId");
        }
        return path;
    }

    private void validateAssignable(Actor actor, List<String> owners) {
        requireBusiness(actor);
        for (String id : owners) access.requireDispatchable(actor, id);
    }

    private void validateActiveOwners(Actor actor, List<String> owners) {
        for (String id : owners) {
            Map<String, Object> user = access.activeUser(actor, id);
            if (user == null || "admin".equals(s(user, "role"))) throw bad("管理员账号不能担任业务负责人");
        }
    }

    private Actor activeActor(Actor context, String id) {
        return access.actor(access.user(context, id));
    }

    private void validateRequestActor(Actor applicant, Map<String, Object> task, Map<String, Object> base, String kind) {
        if (Set.of("create", "change", "reopen").contains(kind)) {
            if (!applicant.id().equals(s(task, "originalCreatorId"))) throw conflict("APPLICANT_NO_LONGER_ALLOWED", "申请人已不具备该操作权限");
        } else if (base == null || !assignees(applicant, s(base, "id")).contains(applicant.id())) throw conflict("APPLICANT_NO_LONGER_ALLOWED", "申请人已不是当前负责人");
    }

    private Map<String, Object> validateForm(Actor actor, Map<String, Object> input, Map<String, Object> base) {
        Map<String, Object> values = new LinkedHashMap<>();
        if (base != null) for (String key : FORM) if (base.containsKey(key)) values.put(key, base.get(key));
        for (String key : FORM) if (input.containsKey(key)) values.put(key, input.get(key));
        values.put("title", requiredText(values, "title", 80));
        values.put("description", requiredText(values, "description", 5000));
        values.put("acceptanceCriteria", requiredText(values, "acceptanceCriteria", 2000));
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
            start = startDate.atStartOfDay(zone).toInstant();
            due = dueDate.atTime(ALL_DAY_CUTOFF).atZone(zone).toInstant();
            values.put("startDate", startDate.toString());
            values.put("dueDate", dueDate.toString());
        } else {
            start = instant(values.get("startAt"), "startAt");
            due = instant(values.get("dueAt"), "dueAt");
            if (due.isBefore(start)) throw bad("截止时间不得早于开始时间");
            values.put("startDate", null);
            values.put("dueDate", null);
        }
        values.put("startAt", start.toString());
        values.put("dueAt", due.toString());
        values.put("assigneeIds", ids(values.get("assigneeIds")));
        values.put("parentTaskId", optionalId(values.get("parentTaskId"), "parentTaskId"));
        return values;
    }

    private Set<String> recipients(Map<String, Object> task, Map<String, Object> base, Map<String, Object> proposed, String applicant, String reviewer, boolean unpublished, boolean includeProposed) {
        Set<String> ids = new LinkedHashSet<>();
        ids.add(applicant);
        if (reviewer != null) ids.add(reviewer);
        if (!unpublished) {
            ids.add(s(task, "originalCreatorId"));
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

    private Map<String, Object> task(Actor actor, String id, boolean lock) {
        requiredId(id, "taskId");
        return db.one("SELECT * FROM tasks WHERE organization_id=? AND id=?" + (lock ? " FOR UPDATE" : ""), actor.organizationId(), id);
    }

    private Map<String, Object> version(Actor actor, String id) {
        return db.one("SELECT * FROM task_versions WHERE organization_id=? AND id=?", actor.organizationId(), id);
    }

    private Map<String, Object> request(Actor actor, String id, boolean lock) {
        requiredId(id, "requestId");
        return db.one("SELECT * FROM approval_requests WHERE organization_id=? AND id=?" + (lock ? " FOR UPDATE" : ""), actor.organizationId(), id);
    }

    private Map<String, Object> pending(Actor actor, String taskId, boolean lock) {
        return db.find("SELECT * FROM approval_requests WHERE organization_id=? AND task_id=? AND status='pending'" + (lock ? " FOR UPDATE" : ""), actor.organizationId(), taskId);
    }

    private List<String> assignees(Actor actor, String versionId) {
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

    private static void requireBusiness(Actor actor) {
        if (!actor.business()) throw forbidden("管理员不参与普通业务操作");
    }

    private static Timestamp now() { return Timestamp.from(Instant.now()); }
    private static ApiException bad(String message) { return new ApiException(400, "INVALID_INPUT", message); }
    private static ApiException forbidden(String message) { return new ApiException(403, "FORBIDDEN", message); }
    private static ApiException conflict(String code, String message) { return new ApiException(409, code, message); }
}
