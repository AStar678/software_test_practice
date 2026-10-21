# 文档导航

## 需求

- [V2 正式版](requirements/潘多拉-产品需求文档-V2正式版.md)：本次反馈整合前的正式基线，文档版本不等于产品交付版本。
- [V2 草案](requirements/潘多拉-产品需求文档-V2草案.md)、[V1 草案](requirements/潘多拉-产品需求文档-V1草案.md)：历史方案与原始问答。
- [需求评审会建议](requirements/需求评审会-甲方建议-汇总.md)、[初步需求](requirements/需求初步整理.md)：早期需求来源，冲突按最新 PRD 处理。

## 历史审计与工程资料

- [正式需求审计清单](reviews/潘多拉-正式需求审计清单.md)、[正式需求偏差报告](reviews/潘多拉-正式需求偏差报告.md)：2026-10-14 的 V2 审计基线，不代表最新代码状态。
- [Chrome CDP 调试指南](guides/无头Chrome-CDP-调试指南.md)。
- [指尖时光截图](references/指尖时光截图)：日历交互参考。
- [后端说明](../backend/README.md)、[实施记录](../backend/docs/implementation-status.md)、[API 示例](../backend/docs/api-examples.http)。
- [主规格](../openspec/specs/pandora-requirements-aligned-prototype/spec.md)、[已归档变更](../openspec/changes/archive)、[按日期保存的验证证据](../audit)。OpenSpec 记录对应当时授权范围，新 PRD 不表示旧变更已完成新增要求。

## 本次整理约定

根目录保留运行入口与前端资源，后端和证据目录沿用原位置。原先根目录的 PRD 与需求来源移至 `docs/requirements/`，两份正式需求审计文档移至 `docs/reviews/`，调试指南移至 `docs/guides/`，参考截图移至 `docs/references/`。文档内可点击链接同步修正；旧审计、证据及 OpenSpec 正文中的历史路径和版本号保留其当时含义。

`backend/scripts/generate_traceability.py` 继续读取历史 V2 基线，其输入路径与已归档变更路径已更新；运行会重新生成历史交接表，不用于本次最新反馈差异分析。
