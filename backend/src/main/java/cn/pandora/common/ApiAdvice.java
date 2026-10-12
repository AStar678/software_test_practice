package cn.pandora.common;

import org.springframework.dao.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import java.util.Map;

@RestControllerAdvice
public class ApiAdvice {
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<?> api(ApiException e) { return ResponseEntity.status(e.status).body(Map.of("code",e.code,"message",e.getMessage())); }
    @ExceptionHandler({IllegalArgumentException.class,HttpMessageNotReadableException.class,MissingRequestHeaderException.class})
    public ResponseEntity<?> invalid(Exception e) { return ResponseEntity.badRequest().body(Map.of("code","INVALID_INPUT","message","请求格式或参数不正确")); }
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<?> constraint(Exception e) { return ResponseEntity.status(409).body(Map.of("code","DATA_CONFLICT","message","数据关系或唯一约束冲突，请刷新后重试")); }
    @ExceptionHandler({CannotAcquireLockException.class,QueryTimeoutException.class})
    public ResponseEntity<?> busy(Exception e) { return ResponseEntity.status(409).header("Retry-After","1").body(Map.of("code","BUSY","message","操作正在处理，请稍后重试")); }
}
