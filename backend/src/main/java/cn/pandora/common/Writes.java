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
    private final Db db; private final TransactionTemplate tx; private final ObjectMapper mapper;
    public Writes(Db db,TransactionTemplate tx,ObjectMapper mapper) {this.db=db;this.tx=tx;this.mapper=mapper;}
    public Map<String,Object> run(Actor actor,String key,String scope,Object body,String ifMatch,Supplier<Map<String,Object>> work) {
        if(key==null || !key.matches("[A-Za-z0-9._:-]{8,80}")) throw new ApiException(400,"IDEMPOTENCY_KEY_REQUIRED","请提供8至80位 Idempotency-Key");
        String digest=AuthService.hash(scope+"\n"+canonical(mapper.valueToTree(body))+"\n"+Objects.toString(ifMatch,""));
        return tx.execute(status->{
            // Local single-company commands deliberately serialize here; this also fixes parent-cycle races.
            var org=db.one("SELECT * FROM organizations WHERE id=? FOR UPDATE",actor.organizationId());
            var user=db.one("SELECT * FROM users WHERE id=? AND organization_id=? AND active=1",actor.id(),actor.organizationId());
            if(!actor.equals(AuthService.actor(user))) throw new ApiException(409,"AUTHORIZATION_CHANGED","权限已更新，请重新读取后操作");
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
            Map<String,Object> result=work.get();
            Map<String,Object> stored=new LinkedHashMap<>(result);stored.put("_authzVersion",n(org,"authzVersion"));
            db.update("INSERT INTO idempotency_keys(organization_id,user_id,scope,key_value,request_hash,response_json) VALUES(?,?,?,?,?,?)",actor.organizationId(),actor.id(),scope,key,digest,db.json(stored));
            return result;
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
