package cn.pandora.common;

import org.springframework.dao.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import java.util.Map;

@RestControllerAdvice
public class ApiAdvice {
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<?> api(ApiException e) {
        java.util.Map<String,Object> body = new java.util.LinkedHashMap<>();
        body.put("code",e.code);
        body.put("message",e.getMessage());
        body.putAll(e.details);
        return ResponseEntity.status(e.status).body(body);
    }
    @ExceptionHandler({IllegalArgumentException.class,HttpMessageNotReadableException.class,
            MissingRequestHeaderException.class,MethodArgumentTypeMismatchException.class})
    public ResponseEntity<?> invalid(Exception e) { return ResponseEntity.badRequest().body(Map.of("code","INVALID_INPUT","message","请求格式或参数不正确")); }
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<?> missing(Exception e) { return ResponseEntity.status(404).body(Map.of("code","NOT_FOUND","message","请求的接口不存在")); }
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<?> constraint(Exception e) { return ResponseEntity.status(409).body(Map.of("code","DATA_CONFLICT","message","数据关系或唯一约束冲突，请刷新后重试")); }
    @ExceptionHandler({CannotAcquireLockException.class,QueryTimeoutException.class})
    public ResponseEntity<?> busy(Exception e) { return ResponseEntity.status(409).header("Retry-After","1").body(Map.of("code","BUSY","message","操作正在处理，请稍后重试")); }
    /**
     * Last-resort safety net: unexpected exceptions keep their diagnostic detail on the server and
     * return one stable Chinese explanation. No class name, stack, SQL fragment or internal field
     * name may reach the client.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> unexpected(Exception e) {
        org.slf4j.LoggerFactory.getLogger(ApiAdvice.class).error("Unhandled API failure", e);
        return ResponseEntity.status(500).body(Map.of("code","INTERNAL_ERROR","message","服务暂时不可用，请稍后重试"));
    }
}
