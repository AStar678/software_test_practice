package cn.pandora.workspace;

import cn.pandora.auth.Access;
import java.util.function.Supplier;
import static org.mockito.Mockito.*;

final class WorkspaceTestSupport {
    private WorkspaceTestSupport() {}
    static Access access() {
        return mock(Access.class, invocation -> "readScope".equals(invocation.getMethod().getName())
                ? ((Supplier<?>)invocation.getArgument(1)).get()
                : RETURNS_DEFAULTS.answer(invocation));
    }
}
