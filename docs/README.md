# 文档导航

## 需求

- [V4 修订版](requirements/潘多拉-产品需求文档-V4修订版.md)：当前需求入口，2026-10-30 更新至 `5f551d2`；整合固定组织、独立管理员、业务责任方审核及接管、日程清单/全天归类、四组任务列、日志逐层搜索、私人标签、加载反馈及跨端质量要求，正文、验收标准与演示要求同步更新；各端进度和验证结果另见工程记录。
- [V4 后续变更对照](reviews/潘多拉-PRD-V4后续变更对照-2026-10-30.md)：从 `216be51` 起追踪 PR #15—#24，区分更改指导/OpenSpec 来源与其余代码挖掘结果，记录旧规则替换及未交付范围。
- [2026-10-28 更改指导](reviews/更改指导.md)：固定位置、独立身份、审核和 Web 交互的历史需求来源，已整合入当前 V4；对应 [已归档 change](../openspec/changes/archive/2026-10-29-refactor-pandora-organization-and-workflows/)，验证结论仅适用其注明基线。
- [V3 修订版](requirements/潘多拉-产品需求文档-V3修订版.md)：上一版需求基线，整合 2026-10-21 的 8 条反馈；保留供追溯。
- [V4 编写前参考（历史）](requirements/潘多拉-产品需求文档-V4编写前必读-已确认保留行为与修订参考-新需求优先.md)：只保留 2026-10-25 创建 V4 前的决策背景，不再要求编写前阅读或沿用冲突旧规则，当前口径见 V4 正文。
- [Web 与管理端代码修改清单](reviews/潘多拉-Web与管理端代码修改清单-2026-10-25.md)：记录 25 项待实施/已收口要求、代码入口及核对要点，不表示已经实施或验收通过。
- [甲方反馈与最新代码差异](reviews/潘多拉-甲方反馈差异分析-2026-10-21.md)：基于 `29ada01` 的静态核对，只适用 V3 的 8 条反馈；V4 反馈所指 `4a4b9b4` 已在当前仓库中，可据此补充差异分析。

- [V2 正式版](requirements/潘多拉-产品需求文档-V2正式版.md)：V3 之前的正式基线，文档版本不等于产品交付版本。
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
