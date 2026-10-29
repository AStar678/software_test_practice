import org.flywaydb.core.Flyway;
/** Controlled Flyway entry: same packaged migrations/driver, no application runners or seed. */
class Migrate {
    public static void main(String[] args) {
        var configuration=Flyway.configure().dataSource(System.getenv("PANDORA_DB_URL"),System.getenv("PANDORA_DB_USER"),System.getenv("PANDORA_DB_PASSWORD"));
        if(args.length>0) configuration.target(args[0]);
        var result=configuration.load().migrate();
        System.out.println("MIGRATED "+result.migrationsExecuted+" -> "+result.targetSchemaVersion);
    }
}
