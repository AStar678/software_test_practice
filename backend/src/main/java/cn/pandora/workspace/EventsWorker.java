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

import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

import static cn.pandora.common.Db.*;

/**
 * Durable local worker. The same organization lock as Writes serializes expiry, reminders, message
 * delivery and clean-up with approvals (DEV-012, DEV-014, DEV-030—033).
 *
 * Scan order is fixed: pending expiry → proportional reminders → event delivery → retention clean-up.
 * Every stage re-reads the current state, so a decision or withdrawal that won the lock first is never
 * overwritten by an older scan.
 */
@Component
@ConditionalOnProperty(name="pandora.worker-enabled",havingValue="true",matchIfMissing=true)
public class EventsWorker {
    private static final Logger log=LoggerFactory.getLogger(EventsWorker.class);
    private final Db db;
    private final WorkspaceService workspace;
    private final ExpiryService expiry;
    private final ReminderService reminders;
    private final ObjectMapper mapper;
    private final TransactionTemplate transaction;
    private final Access access;
    private final Clock clock;
    private final AtomicBoolean running = new AtomicBoolean();

    public EventsWorker(Db db,WorkspaceService workspace,ExpiryService expiry,ReminderService reminders,
                        ObjectMapper mapper,PlatformTransactionManager tx,Access access,Clock clock) {
        this.db=db;this.workspace=workspace;this.expiry=expiry;this.reminders=reminders;
        this.mapper=mapper;this.transaction=new TransactionTemplate(tx);this.access=access;this.clock=clock;
    }

    @Scheduled(fixedDelayString="${pandora.worker.delay-ms:3000}",initialDelayString="${pandora.worker.initial-delay-ms:3000}")
    public void runOnce() {
        // The scheduler can overlap itself after a slow scan; one local worker pass at a time is enough.
        if (!running.compareAndSet(false, true)) return;
        try {
            for (var organization:db.list("SELECT id FROM organizations ORDER BY id")) {
                String org=s(organization,"id");
                try {
                    transaction.executeWithoutResult(status->{
                        var locked=db.one("SELECT * FROM organizations WHERE id=? FOR UPDATE",org);
                        Instant now=clock.instant();
                        ZoneId zone=ZoneId.of(s(locked,"timeZone"));
                        expiry.expirePending(org,now);
                        reminders.createReminders(org,now);
                        deliver(org,zone,now);
                        workspace.cleanupNotifications(org,now);
                    });
                } catch(Exception ex) {
                    log.warn("Local event worker transaction failed for organization {}: {}",org,ex.getClass().getSimpleName());
                }
            }
        } finally {
            running.set(false);
        }
    }

    /**
     * Turn each pending event into one copy per recipient. The recipient list is only a candidate list:
     * ordinary events that lost task authority before delivery get no restricted content and no task
     * entry. A removal event proves the old effective-owner fact and therefore keeps the read-only
     * historical entry (DEV-030, DEV-033).
     */
    private void deliver(String org,ZoneId zone,Instant now) {
        for(var event:db.list("SELECT * FROM domain_events WHERE organization_id=? AND status='pending' ORDER BY created_at,id LIMIT 100 FOR UPDATE",org)) {
            List<String> recipients;
            try {recipients=mapper.readValue(s(event,"recipientsJson"),new TypeReference<List<String>>(){});}
            catch(Exception ex) {throw new IllegalStateException("Invalid durable event recipient payload",ex);}
            Map<String,Object> details=event.get("detailsJson")==null?Map.of():db.parse(s(event,"detailsJson"));
            Set<String> removed=new HashSet<>();
            if (details.get("removedUserIds") instanceof Collection<?> ids) for (Object id:ids) removed.add(String.valueOf(id));
            boolean revoked=event.get("revokedAt")!=null;
            String taskId=s(event,"taskId");
            String summary=s(event,"changeSummary")==null?s(event,"eventType"):s(event,"changeSummary");
            String title=s(event,"title");
            for(String recipient:new LinkedHashSet<>(recipients)) {
                Actor actor=activeActor(org,recipient);
                if(actor==null) continue;
                boolean canRead=taskId!=null && workspace.canReadTask(actor,taskId,true);
                boolean relationLost=!canRead && removed.contains(recipient);
                boolean keepTask=!revoked && (canRead||relationLost);
                // An ordinary candidate who lost task authority before delivery gets no restricted
                // content and no historical entry. Only a recipient that can still read the task, or a
                // removal event that proves the old effective-owner fact, keeps the title/summary
                // (design §7, DEV-033).
                boolean contentMasked=!revoked && !canRead && !relationLost;
                String copySummary;
                String copyTitle;
                boolean readonly;
                if(revoked) {
                    copySummary="该通知已被撤回。";copyTitle=null;readonly=true;
                } else if(canRead) {
                    copySummary=truncate(summary,255);copyTitle=title;readonly=Boolean.TRUE.equals(event.get("readonly"));
                } else if(relationLost) {
                    copySummary="你已不再是该任务负责人；此消息保留只读摘要，请查看当前有效任务。";
                    copyTitle=title;readonly=true;
                } else {
                    copySummary="你的工作关系或访问范围已变化，请查看当前工作安排。";copyTitle=null;readonly=true;
                }
                db.update("INSERT IGNORE INTO notifications(id,organization_id,event_id,recipient_id,event_type,task_id,summary,"
                                + "request_id,task_version_id,delivered_at,expires_at,source,readonly,title,change_summary,relation_lost,content_masked) "
                                + "VALUES(?,?,?,?,?,?,?,?,?,?,?,'event',?,?,?,?,?)",
                        id(),org,s(event,"id"),recipient,s(event,"eventType"),keepTask?taskId:null,copySummary,
                        contentMasked?null:s(event,"requestId"),contentMasked?null:s(event,"taskVersionId"),Timestamp.from(now),
                        event.get("expiresAt"),readonly,copyTitle,
                        contentMasked||revoked?null:s(event,"changeSummary"),relationLost,contentMasked);
            }
            db.update("UPDATE domain_events SET status='delivered',delivered_at=? WHERE organization_id=? AND id=? AND status='pending'",
                    Timestamp.from(now),org,s(event,"id"));
        }
    }

    private Actor activeActor(String org,String userId) {
        var user=db.find("SELECT * FROM users WHERE organization_id=? AND id=? AND active=1",org,userId);
        if(user==null || "admin".equals(s(user,"role"))) return null;
        return access.actor(user);
    }

    private static String truncate(String value,int limit) {
        if(value==null) return null;
        return value.length()<=limit?value:value.substring(0,limit);
    }
}
