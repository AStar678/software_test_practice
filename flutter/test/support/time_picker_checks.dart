import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void use24HourPicker(WidgetTester tester) {
  tester.platformDispatcher.alwaysUse24HourFormatTestValue = true;
  addTearDown(tester.platformDispatcher.clearAlwaysUse24HourTestValue);
}

Future<void> tapPickerControl(WidgetTester tester, Finder button) async {
  await tester.ensureVisible(button);
  await tester.tap(button);
  await tester.pumpAndSettle();
}

Future<void> confirmPickerDate(WidgetTester tester) async {
  final picker = find.byType(DatePickerDialog);
  expect(picker, findsOneWidget);
  await tester.tap(find.descendant(of: picker, matching: find.text('确定')));
  await tester.pumpAndSettle();
}

Future<void> typePickerTime(
  WidgetTester tester, {
  required String hour,
  required String minute,
  bool cancel = false,
}) async {
  final picker = find.byType(TimePickerDialog);
  expect(
    tester.widget<TimePickerDialog>(picker).initialEntryMode,
    TimePickerEntryMode.inputOnly,
  );
  final fields = find.descendant(of: picker, matching: find.byType(TextField));
  expect(fields, findsNWidgets(2));
  expect(
    find.descendant(of: picker, matching: find.byIcon(Icons.access_time)),
    findsNothing,
  );
  expect(
    find.descendant(of: picker, matching: find.byIcon(Icons.keyboard_outlined)),
    findsNothing,
  );
  final confirm = find.descendant(of: picker, matching: find.text('确定'));
  final localizations = MaterialLocalizations.of(tester.element(picker));
  await tester.enterText(fields.first, '99');
  await tester.enterText(fields.last, '99');
  await tester.tap(confirm);
  await tester.pumpAndSettle();
  expect(picker, findsOneWidget);
  expect(find.text(localizations.invalidTimeLabel), findsOneWidget);
  await tester.enterText(fields.first, hour);
  await tester.enterText(fields.last, minute);
  await tester.tap(
    cancel ? find.descendant(of: picker, matching: find.text('取消')) : confirm,
  );
  await tester.pumpAndSettle();
  expect(picker, findsNothing);
}

Future<void> exerciseFormTime(
  WidgetTester tester,
  String label,
  String hour,
  String minute,
) async {
  final button = find.ancestor(
    of: find.textContaining(RegExp('^$label ')),
    matching: find.byType(OutlinedButton),
  );
  final before = tester
      .widgetList<Text>(
        find.descendant(of: button, matching: find.byType(Text)),
      )
      .single
      .data;
  Future<void> open() async {
    await tapPickerControl(tester, button);
    await confirmPickerDate(tester);
  }

  await open();
  await typePickerTime(tester, hour: hour, minute: minute, cancel: true);
  expect(find.text(before!), findsOneWidget);
  await open();
  await typePickerTime(tester, hour: hour, minute: minute);
  expect(find.textContaining('$hour:$minute'), findsOneWidget);
}
