package cn.pandora.auth;

import cn.pandora.common.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.Map;
import java.util.Set;

/**
 * Authentication plus the forced-password-change gate (DEV-003).
 *
 * A session flagged `must_change_password` — a brand-new account or an administrator reset — may only
 * read its own identity, change its password, or log out. The gate lives in the filter, not in the
 * pages, so a direct business request, a refreshed token or a workspace loaded by URL cannot bypass it.
 */
@Component
public class AuthFilter extends OncePerRequestFilter {
    /** Exact method+path pairs a restricted session may still reach. */
    private static final Set<String> GATE_ALLOWED = Set.of(
            "GET /api/v1/auth/session",
            "POST /api/v1/auth/password",
            "DELETE /api/v1/auth/sessions/current");

    private final AuthService auth;private final ObjectMapper mapper;
    public AuthFilter(AuthService auth,ObjectMapper mapper) {this.auth=auth;this.mapper=mapper;}
    @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain) throws ServletException,IOException {
        res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("X-Frame-Options","DENY");
        if(!req.getRequestURI().startsWith("/api/") || (req.getRequestURI().equals("/api/v1/auth/sessions") && req.getMethod().equals("POST"))) { chain.doFilter(req,res); return; }
        res.setHeader("Cache-Control","no-store");
        Actor actor;
        try {
            String header=req.getHeader("Authorization");
            String token=header!=null&&header.startsWith("Bearer ")?header.substring(7):null;
            actor=auth.authenticate(token); req.setAttribute("actor",actor); req.setAttribute("token",token);
        } catch(ApiException e) {
            res.setStatus(e.status);res.setContentType("application/json;charset=UTF-8");
            mapper.writeValue(res.getOutputStream(),Map.of("code",e.code,"message",e.getMessage()));return;
        }
        if(actor.mustChangePassword() && !GATE_ALLOWED.contains(req.getMethod()+" "+req.getRequestURI())) {
            res.setStatus(403);res.setContentType("application/json;charset=UTF-8");
            mapper.writeValue(res.getOutputStream(),Map.of("code","PASSWORD_CHANGE_REQUIRED",
                    "message","首次登录或管理员重置后必须修改密码，当前会话仅可改密或退出"));
            return;
        }
        chain.doFilter(req,res);
    }
}
