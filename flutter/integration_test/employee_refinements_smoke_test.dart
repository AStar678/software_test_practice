import 'package:integration_test/integration_test.dart';

import '../test/features/app_navigation_test.dart' as navigation;
import '../test/features/daily_items_ui_test.dart' as daily_items;
import '../test/features/employee_refinements_test.dart' as refinements;
import '../test/features/fading_name_test.dart' as fading_name;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  navigation.main();
  daily_items.main();
  refinements.main();
  fading_name.main();
}
