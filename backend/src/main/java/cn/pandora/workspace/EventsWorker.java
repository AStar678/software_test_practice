package cn.pandora.workspace;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.Db;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;

import static cn.pandora.common.Db.*;

/** Durable local worker. The same organization lock as Writes serializes reminders with approvals. */
@Component
@ConditionalOnProperty(name="pandora.worker-enabled",havingValue="true",matchIfMissing=true)
public class EventsWorker {
    private static final Logger log=LoggerFactory.getLogger(EventsWorker.class);
    private final Db db;
    private final WorkspaceService workspace;
    private final ObjectMapper mapper;
    private final TransactionTemplate transaction;
    private final Access access;

    public EventsWorker(Db db,WorkspaceService workspace,ObjectMapper mapper,PlatformTransactionManager tx,Access access) {
        this.db=db;this.workspace=workspace;this.mapper=mapper;this.transaction=new TransactionTemplate(tx);this.access=access;
    }

    @Scheduled(fixedDelayString="${pandora.worker.delay-ms:3000}",initialDelayString="${pandora.worker.initial-delay-ms:3000}")
    public void runOnce() {
        for (var organization:db.list("SELECT id FROM organizations ORDER BY id")) {
            String org=s(organization,"id");
            try {
                transaction.executeWithoutResult(status->{
                    var locked=db.one("SELECT * FROM organizations WHERE id=? FOR UPDATE",org);
                    createReminders(org,ZoneId.of(s(locked,"timeZone")),Instant.now());
                    deliver(org);
                });
            } catch(Exception ex) {
                log.warn("Local event worker transaction failed for organization {}: {}",org,ex.getClass().getSimpleName());
            }
        }
    }

    private void createReminders(String org,ZoneId zone,Instant now) {
        var candidates=db.list("SELECT t.*,v.due_at FROM tasks t JOIN task_versions v ON v.id=t.current_version_id AND v.task_id=t.id AND v.organization_id=t.organization_id WHERE t.organization_id=? AND t.execution_state<>'done' AND v.due_at<=? AND NOT EXISTS (SELECT 1 FROM approval_requests a WHERE a.organization_id=t.organization_id AND a.task_id=t.id AND a.status='pending') ORDER BY v.due_at,t.id",org,Timestamp.from(now.plus(Duration.ofDays(3))));
        for(var task:candidates) {
            Instant due=WorkspaceService.instant(s(task,"dueAt"));
            if(due==null) continue;
            boolean overdue=due.isBefore(now);
            String taskId=s(task,"id");
            var recipients=new LinkedHashSet<String>();
            recipients.add(s(task,"originalCreatorId"));
            for(var r:db.list("SELECT user_id FROM task_version_assignees WHERE organization_id=? AND version_id=?",org,s(task,"currentVersionId"))) recipients.add(s(r,"userId"));
            for(String recipient:recipients) {
                Actor actor=activeActor(org,recipient);
                if(actor==null || !workspace.canReadTask(actor,taskId,false)) continue;
                String basis=org+":"+taskId+":"+recipient+":"+n(task,"executionRound")+":"+
                    (overdue?"overdue:"+n(task,"dueVersion"):"near:"+LocalDate.ofInstant(now,zone));
                int inserted=db.update("INSERT IGNORE INTO reminder_receipts(id,organization_id,task_id,recipient_id,dedupe_key) VALUES(?,?,?,?,?)",id(),org,taskId,recipient,hash(basis));
                if(inserted==0) continue;
                db.update("INSERT INTO domain_events(id,organization_id,task_id,event_type,recipients_json,details_json,status) VALUES(?,?,?,?,?,?,'pending')",
                    id(),org,taskId,overdue?"task.overdue":"task.due_soon",db.json(List.of(recipient)),
                    db.json(Map.of("origin","scheduled_rule","executionRound",n(task,"executionRound"),"dueVersion",n(task,"dueVersion"))));
            }
        }
    }

    private void deliver(String org) {
        for(var event:db.list("SELECT * FROM domain_events WHERE organization_id=? AND status='pending' ORDER BY created_at,id LIMIT 100 FOR UPDATE",org)) {
            List<String> recipients;
            try {recipients=mapper.readValue(s(event,"recipientsJson"),new TypeReference<List<String>>(){});}
            catch(Exception ex) {throw new IllegalStateException("Invalid durable event recipient payload",ex);}
            for(String recipient:new LinkedHashSet<>(recipients)) {
                Actor actor=activeActor(org,recipient);
                if(actor==null) continue;
                boolean canRead=workspace.canReadTask(actor,s(event,"taskId"),true);
                db.update("INSERT IGNORE INTO notifications(id,organization_id,event_id,recipient_id,event_type,task_id,summary) VALUES(?,?,?,?,?,?,?)",
                    id(),org,s(event,"id"),recipient,s(event,"eventType"),canRead?s(event,"taskId"):null,
                    canRead?summary(s(event,"eventType")):"你的工作关系或访问范围已变化，请查看当前工作安排。");
            }
            db.update("UPDATE domain_events SET status='delivered',delivered_at=UTC_TIMESTAMP(6) WHERE organization_id=? AND id=? AND status='pending'",org,s(event,"id"));
        }
    }

    private Actor activeActor(String org,String userId) {
        var user=db.find("SELECT * FROM users WHERE organization_id=? AND id=? AND active=1",org,userId);
        if(user==null || "admin".equals(s(user,"role"))) return null;
        return access.actor(user);
    }
    private static String summary(String type) {
        if("task.overdue".equals(type)) return "任务已超过截止时间，请查看当前安排。";
        if("task.due_soon".equals(type)) return "任务将在三天内截止，请查看当前安排。";
        if(type.contains("reject")) return "任务申请已退回，请查看审核结果。";
        if(type.contains("withdraw")) return "任务申请已撤销。";
        if(type.contains("approv") || type.contains("direct")) return "任务审核状态已更新，请查看详情。";
        return "有一项任务动态，请进入详情查看。";
    }
    private static String hash(String value) {
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}
        catch(Exception ex){throw new IllegalStateException(ex);}
    }
}
