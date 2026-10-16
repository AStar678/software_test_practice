package cn.pandora.common;

import cn.pandora.auth.*;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;
import java.util.function.Supplier;
import static cn.pandora.common.Db.*;

@Component
public class Writes {
    private final Db db; private final TransactionTemplate tx; private final ObjectMapper mapper; private final AuthService auth;
    public Writes(Db db,TransactionTemplate tx,ObjectMapper mapper,AuthService auth) {this.db=db;this.tx=tx;this.mapper=mapper;this.auth=auth;}

    /**
     * A command outcome split into the part that may be replayed from the idempotency cache and the
     * part that may be shown exactly once. One-time credentials (initial passwords) go in the second
     * part, so a lost response can never re-display a secret and the cache never stores one.
     */
    public record Outcome(Map<String,Object> replayable, Map<String,Object> oneTimeOnly) {
        public static Outcome of(Map<String,Object> replayable) { return new Outcome(replayable, Map.of()); }
    }

    public Map<String,Object> run(Actor actor,String key,String scope,Object body,String ifMatch,Supplier<Map<String,Object>> work) {
        return runOutcome(actor,key,scope,body,ifMatch,() -> Outcome.of(work.get()));
    }

    /**
     * Same transaction and idempotency contract, for commands that return a one-time secret. Named
     * separately because Java cannot overload on a generic type argument.
     */
    public Map<String,Object> runOutcome(Actor actor,String key,String scope,Object body,String ifMatch,Supplier<Outcome> work) {
        if(key==null || !key.matches("[A-Za-z0-9._:-]{8,80}")) throw new ApiException(400,"IDEMPOTENCY_KEY_REQUIRED","请提供8至80位 Idempotency-Key");
        String digest=AuthService.hash(scope+"\n"+canonical(mapper.valueToTree(body))+"\n"+Objects.toString(ifMatch,""));
        return tx.execute(status->{
            // Local single-company commands deliberately serialize here; this also fixes parent-cycle races.
            var org=db.one("SELECT * FROM organizations WHERE id=? FOR UPDATE",actor.organizationId());
            var user=db.one("SELECT * FROM users WHERE id=? AND organization_id=? AND active=1",actor.id(),actor.organizationId());
            if(!actor.equals(auth.actor(user))) throw new ApiException(409,"AUTHORIZATION_CHANGED","权限已更新，请重新读取后操作");
            var previous=db.find("SELECT * FROM idempotency_keys WHERE organization_id=? AND user_id=? AND scope=? AND key_value=?",actor.organizationId(),actor.id(),scope,key);
            if(previous!=null) {
                if(!digest.equals(s(previous,"requestHash"))) throw new ApiException(409,"IDEMPOTENCY_CONFLICT","同一幂等键不能用于不同请求");
                var cached=db.parse(s(previous,"responseJson"));
                // A later permission change must not replay a previously authorized result.
                Object saved=cached.remove("_authzVersion");
                if(!(saved instanceof Number value) || value.longValue()!=n(org,"authzVersion"))
                    throw new ApiException(409,"AUTHORIZATION_CHANGED","权限已变化，请使用新请求");
                return cached;
            }
            Outcome outcome=work.get();
            // Store the version as it stands *after* the command: an idempotent retry of the same
            // request must still replay, while any later authority change must invalidate the cache.
            var afterOrg=db.one("SELECT authz_version FROM organizations WHERE id=?",actor.organizationId());
            Map<String,Object> stored=new LinkedHashMap<>(outcome.replayable());stored.put("_authzVersion",n(afterOrg,"authzVersion"));
            db.update("INSERT INTO idempotency_keys(organization_id,user_id,scope,key_value,request_hash,response_json) VALUES(?,?,?,?,?,?)",actor.organizationId(),actor.id(),scope,key,digest,db.json(stored));
            Map<String,Object> response=new LinkedHashMap<>(outcome.replayable());
            response.putAll(outcome.oneTimeOnly());
            return response;
        });
    }
    private JsonNode canonical(JsonNode node) {
        if(node.isObject()) { ObjectNode result=mapper.createObjectNode();List<String> names=new ArrayList<>();node.fieldNames().forEachRemaining(names::add);Collections.sort(names);names.forEach(k->result.set(k,canonical(node.get(k))));return result; }
        if(node.isArray()) {ArrayNode result=mapper.createArrayNode();node.forEach(v->result.add(canonical(v)));return result;}
        return node;
    }
    public static void checkVersion(String ifMatch,long version) {
        if(ifMatch==null || ifMatch.isBlank()) throw new ApiException(428,"PRECONDITION_REQUIRED","请先读取详情并提交 If-Match");
        if(!ifMatch.equals("\""+version+"\"")) throw new ApiException(412,"VERSION_CONFLICT","内容已更新，请刷新后重试");
    }
}
