package cn.pandora.common;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import java.sql.*;
import java.util.*;

@Component
public class Db {
    public final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    public Db(JdbcTemplate jdbc,ObjectMapper mapper) { this.jdbc=jdbc; this.mapper=mapper; }
    public List<Map<String,Object>> list(String sql,Object...args) {
        return jdbc.query(sql,(rs,n)-> {
            Map<String,Object> row=new LinkedHashMap<>();
            ResultSetMetaData meta=rs.getMetaData();
            for(int i=1;i<=meta.getColumnCount();i++) {
                Object v=rs.getObject(i);
                if(v instanceof Timestamp t) v=t.toInstant().toString();
                else if(v instanceof java.time.LocalDateTime t) v=t.toInstant(java.time.ZoneOffset.UTC).toString();
                else if(v instanceof java.sql.Date d) v=d.toLocalDate().toString();
                else if(v instanceof byte[] b) v=new String(b,java.nio.charset.StandardCharsets.UTF_8);
                row.put(camel(meta.getColumnLabel(i)),v);
            }
            return row;
        },args);
    }
    public Map<String,Object> find(String sql,Object...args) { var rows=list(sql,args); return rows.isEmpty()?null:rows.getFirst(); }
    public Map<String,Object> one(String sql,Object...args) { var r=find(sql,args); if(r==null) throw ApiException.notFound(); return r; }
    public int update(String sql,Object...args) { return jdbc.update(sql,args); }
    public String json(Object value) { try { return mapper.writeValueAsString(value); } catch(Exception e) { throw new IllegalArgumentException("无法编码JSON",e); } }
    public Map<String,Object> parse(String json) { try { return mapper.readValue(json,new TypeReference<>(){}); } catch(Exception e) { throw new IllegalArgumentException("无法读取JSON",e); } }
    public static String id() { return UUID.randomUUID().toString(); }
    public static String s(Map<String,?> r,String k) { Object v=r.get(k); return v==null?null:v.toString(); }
    public static long n(Map<String,?> r,String k) { Object v=r.get(k); return v instanceof Number num?num.longValue():Long.parseLong(v.toString()); }
    private static String camel(String raw) {
        StringBuilder s=new StringBuilder(); boolean upper=false;
        for(char c:raw.toCharArray()) { if(c=='_') upper=true; else { s.append(upper?Character.toUpperCase(c):c); upper=false; } }
        return s.toString();
    }
}
