import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/net/idempotency.dart';
import 'package:pandora_employee/core/net/pagination.dart';

class _Row {
  _Row(this.id);
  final String id;
}

void main() {
  group('PagedAccumulator', () {
    test('按 ID 去重、读完所有页才算完整', () {
      final accumulator = PagedAccumulator<_Row>(idOf: (row) => row.id, cursorKind: CursorKind.offsetNumber)..restart();
      final generation = accumulator.generation;

      accumulator.addPage(
        PagedPage(items: [_Row('a'), _Row('b')], total: 3, nextOffset: 2),
        generation: generation,
      );
      expect(accumulator.complete, isFalse);
      expect(accumulator.items.length, 2);

      accumulator.addPage(
        PagedPage(items: [_Row('b'), _Row('c')], total: 3, nextOffset: null),
        generation: generation,
      );
      expect(accumulator.complete, isTrue);
      expect(accumulator.items.map((row) => row.id), ['a', 'b', 'c']);
      expect(accumulator.total, 3);
    });

    test('后页失败保留首屏且不宣称完整，重试可继续', () {
      final accumulator = PagedAccumulator<_Row>(idOf: (row) => row.id, cursorKind: CursorKind.offsetNumber)..restart();
      final generation = accumulator.generation;
      accumulator.addPage(PagedPage(items: [_Row('a')], nextOffset: 1), generation: generation);
      accumulator.fail(StateError('boom'), generation: generation);

      expect(accumulator.failed, isTrue);
      expect(accumulator.complete, isFalse);
      expect(accumulator.items.length, 1);

      accumulator.retryGeneration();
      accumulator.addPage(PagedPage(items: [_Row('a'), _Row('b')], nextOffset: null), generation: generation);
      expect(accumulator.failed, isFalse);
      expect(accumulator.complete, isTrue);
      expect(accumulator.items.map((row) => row.id), ['a', 'b']);
    });

    test('切换查询代次后旧响应被丢弃', () {
      final accumulator = PagedAccumulator<_Row>(idOf: (row) => row.id, cursorKind: CursorKind.offsetNumber)..restart();
      final oldGeneration = accumulator.generation;
      accumulator.restart(); // 用户改筛选/刷新
      final newGeneration = accumulator.generation;

      final accepted = accumulator.addPage(PagedPage(items: [_Row('late')], nextOffset: null), generation: oldGeneration);
      expect(accepted, isFalse);
      expect(accumulator.items, isEmpty);

      accumulator.addPage(PagedPage(items: [_Row('current')], nextOffset: null), generation: newGeneration);
      expect(accumulator.items.single.id, 'current');
      expect(accumulator.complete, isTrue);
    });

    test('三种游标分别记录', () {
      expect(CursorKind.values, containsAll([CursorKind.offsetNumber, CursorKind.offsetString, CursorKind.stableId]));
    });
  });

  group('IdempotencyGuard', () {
    test('同体同版本沿用键，改体或改版本换键', () {
      final guard = IdempotencyGuard();
      final first = guard.keyFor(IdempotencyGuard.fingerprint(
        method: 'PATCH',
        path: '/tasks/1',
        ifMatch: '"3"',
        body: {'command': 'change', 'title': 'A'},
      ));
      final retry = guard.keyFor(IdempotencyGuard.fingerprint(
        method: 'PATCH',
        path: '/tasks/1',
        ifMatch: '"3"',
        body: {'title': 'A', 'command': 'change'},
      ));
      expect(retry, first);

      final changedBody = guard.keyFor(IdempotencyGuard.fingerprint(
        method: 'PATCH',
        path: '/tasks/1',
        ifMatch: '"3"',
        body: {'command': 'change', 'title': 'B'},
      ));
      expect(changedBody, isNot(first));

      final changedVersion = guard.keyFor(IdempotencyGuard.fingerprint(
        method: 'PATCH',
        path: '/tasks/1',
        ifMatch: '"4"',
        body: {'command': 'change', 'title': 'B'},
      ));
      expect(changedVersion, isNot(changedBody));
      expect(first.length, greaterThanOrEqualTo(IdempotencyGuard.minLength));
      expect(first.length, lessThanOrEqualTo(IdempotencyGuard.maxLength));
    });

    test('成功提交后重置生成新键', () {
      final guard = IdempotencyGuard();
      final fingerprint = IdempotencyGuard.fingerprint(method: 'POST', path: '/tasks', body: {'title': 'x'});
      final first = guard.keyFor(fingerprint);
      guard.reset();
      expect(guard.keyFor(fingerprint), isNot(first));
    });
  });
}
