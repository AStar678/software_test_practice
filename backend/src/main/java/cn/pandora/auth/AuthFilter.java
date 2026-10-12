package cn.pandora.auth;

import cn.pandora.common.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.Map;

@Component
public class AuthFilter extends OncePerRequestFilter {
    private final AuthService auth;private final ObjectMapper mapper;
    public AuthFilter(AuthService auth,ObjectMapper mapper) {this.auth=auth;this.mapper=mapper;}
    @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain) throws ServletException,IOException {
        res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("X-Frame-Options","DENY");
        if(!req.getRequestURI().startsWith("/api/") || (req.getRequestURI().equals("/api/v1/auth/sessions") && req.getMethod().equals("POST"))) { chain.doFilter(req,res); return; }
        res.setHeader("Cache-Control","no-store");
        try {
            String header=req.getHeader("Authorization");
            String token=header!=null&&header.startsWith("Bearer ")?header.substring(7):null;
            req.setAttribute("actor",auth.authenticate(token)); req.setAttribute("token",token);
        } catch(ApiException e) {
            res.setStatus(e.status);res.setContentType("application/json;charset=UTF-8");
            mapper.writeValue(res.getOutputStream(),Map.of("code",e.code,"message",e.getMessage()));return;
        }
        chain.doFilter(req,res);
    }
}
