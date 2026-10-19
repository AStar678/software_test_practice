package cn.pandora.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

/** The single injectable clock used by deadlines, reminders and message retention. */
@Configuration
public class TimeConfig {
    @Bean
    Clock clock(@Value("${pandora.clock.fixed-time:}") String fixedTime,
                @Value("${pandora.clock.controllable:false}") boolean controllable) {
        Instant fixed = fixedTime == null || fixedTime.isBlank() ? null : Instant.parse(fixedTime.strip());
        if (controllable) return new ControllableClock(fixed, ZoneOffset.UTC);
        return fixed == null ? Clock.systemUTC() : Clock.fixed(fixed, ZoneOffset.UTC);
    }
}
