package cn.pandora.admin;

import cn.pandora.auth.Actor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Restricted team-management read used by the employee web entry in "My" (chapter 9.4).
 *
 * <p>It is not part of the administrator console: an authorized department lead receives only their
 * own department, its teams and that department's lead candidates. Creating or transferring a team
 * reuses the existing team commands, which re-check the grant on every call.
 */
@RestController
@RequestMapping("/api/v1")
public class TeamManagementController {
    private final OrganizationService organization;

    public TeamManagementController(OrganizationService organization) {
        this.organization = organization;
    }

    @GetMapping("/me/team-management")
    public Map<String, Object> teamManagement(@RequestAttribute("actor") Actor actor) {
        return organization.teamManagement(actor);
    }
}
