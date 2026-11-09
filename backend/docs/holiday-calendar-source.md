# 节假日年度数据源与维护

本文件是 change `prepare-employee-client-contracts-and-business-upgrade` 第 7 章来源核验、运行配置和故障恢复的实施记录。它只描述日历标识来源；任务排期、工期、提醒和日志日期继续按原业务规则计算，不因节假日数据改变。

## 1. 选定来源与契约

- 候选年度数据：`NateScarlet/holiday-cn`（MIT）。
  - 仓库：<https://github.com/NateScarlet/holiday-cn>
  - 年度文件格式：`https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/{year}.json`
  - 备用 CDN：`https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/{year}.json`
  - 每年一个 JSON：`{"year":2026,"papers":["<国务院通知 URL>"],"days":[{"name":"元旦","date":"2026-01-01","isOffDay":true}]}`。
  - `papers` 是所用国务院文件 URL；`days` 只列官方特殊安排，普通周末不自动补入。数据由项目自动抓取国务院公告，按公告标题年份归档，MIT 许可，README 建议高稳定场景自建静态文件服务。
- 权威依据：国务院办公厅《关于2026年部分节假日安排的通知》（国办发明电〔2025〕7号，2025-11-04），<https://www.gov.cn/zhengce/content/202511/content_7047090.htm>。核验日期 2026-11-09。

适配器只接受后端固定配置的模板，不接受客户端 URL。`{year}` 由服务端替换；默认来源标识为 `NateScarlet/holiday-cn`。

## 2. 2026 官方样本核对

按上述通知逐条对照 `days`：

| 节日 | 休假日 | 调班工作日 |
| --- | --- | --- |
| 元旦 | 01-01、01-02、01-03 | 01-04 |
| 春节 | 02-15 至 02-23（9 天） | 02-14、02-28 |
| 清明节 | 04-04、04-05、04-06 | — |
| 劳动节 | 05-01 至 05-05（5 天） | 05-09 |
| 端午节 | 06-19、06-20、06-21 | — |
| 中秋节 | 09-25、09-26、09-27 | — |
| 国庆节 | 10-01 至 10-07（7 天） | 09-20、10-10 |

共 39 条：33 条 `isOffDay=true`，6 条 `isOffDay=false`；日期均属于 2026，无重复。完整样本由 `backend/scripts/check_holidays.py::official_2026` 提供，并作为隔离真实服务检查的本地年度响应，不依赖运行时外网。该样本与通知逐条一致；普通周末没有被写成官方调休。

## 3. 访问核验结论（必须如实保留）

- `https://github.com/NateScarlet/holiday-cn` 仓库页面可访问；其 README/格式说明已核验。
- 当前 Windows 实施机无法从进程内访问 `raw.githubusercontent.com` 及 `cdn.jsdelivr.net`（TLS/代理层连接失败），因此**本次没有把实时外网抓取标为已通过**。默认模板保留为候选地址，部署环境必须实际验证出站访问；不能把本地 fixture 的成功当成公网可用。
- 若部署环境仍无法访问候选地址，可把同一 JSON 契约的年度文件自建/镜像到固定 HTTPS 地址，只改 `PANDORA_HOLIDAY_SOURCE_URL_TEMPLATE`，不改 API、校验或缓存语义；来源记录必须同步更新。

## 4. 运行配置

| 配置 | 默认 | 说明 |
| --- | --- | --- |
| `PANDORA_HOLIDAY_BACKGROUND_ENABLED` | `true` | 关闭后不启动当前年/次年检查，也不在 GET 时登记后台意图；用于隔离测试 |
| `PANDORA_HOLIDAY_SOURCE_URL_TEMPLATE` | 候选 raw GitHub 年度文件 | 固定模板，必须含 `{year}`；仅 HTTP(S) |
| `PANDORA_HOLIDAY_SOURCE_NAME` | `NateScarlet/holiday-cn` | 写入缓存和响应的来源标识，不含凭证 |
| `PANDORA_HOLIDAY_CONNECT_TIMEOUT_MS` | `3000` | 连接超时 |
| `PANDORA_HOLIDAY_REQUEST_TIMEOUT_MS` | `10000` | 单次请求总超时 |
| `PANDORA_HOLIDAY_MAX_BYTES` | `1048576` | 响应体上限（1 MiB） |
| `PANDORA_HOLIDAY_RETRIES` | `1` | 仅对超时/IO/非 2xx 做有限重试，4xx 不重试 |
| `PANDORA_HOLIDAY_WORKER_THREADS` | `2` | 按年获取的并发上限 |
| `PANDORA_HOLIDAY_CHECK_CRON` | `0 15 3 * * *`（UTC） | 每日检查当前年/次年 |

## 5. 读取与刷新

- `GET /api/v1/calendar/holidays/{year}`：当前有效员工及独立管理员；只读本地缓存，绝不等待外网。返回 `year/region/status/days/source/updatedAt`，失败时额外给安全 `reason`。
  - `ready`：有有效年度缓存。
  - `stale`：最近一次刷新失败，仍返回原 `days/source/updatedAt`。
  - `missing`：无有效缓存，`days=[]`、`updatedAt=null`，不推算、不补造。
- `POST /api/v1/admin/calendar/holidays/{year}/refresh`：仅独立管理员，必须 `Idempotency-Key`。抓取/解析在短写事务之外；成功才整年原子替换并写 `audit_logs`（`holiday.calendar.refreshed`，含 year/source/hash/notice/day 数），失败返回 502 `HOLIDAY_REFRESH_FAILED` 与安全 `reason`，保留旧缓存和成功时间。请求不能指定 URL。
- 后台：启动及每日检查当前年/次年；缺失年按年去重、失败后至少 24 小时才再次尝试；不因重复 GET 放大外网请求，不预测未公布年份。

## 6. 失败与恢复

1. 外源 404/410、超时、非 2xx、超限体、非法 JSON、年份不符、跨年/重复/空名称/非布尔 `isOffDay`、缺少 `papers`：整年拒绝，不部分发布。
2. 已有缓存时刷新失败只更新 `last_attempt_at/last_failure_at/last_failure_code`；`days/source/fetched_at` 不变，GET 变 `stale`。
3. 从未成功获取的年份只保留失败状态；GET 返回 `missing`，不把 404 当成“该年没有假期”。
4. 外源恢复后，管理员可显式刷新，或后台在 24 小时间隔后重试；成功后清除失败码并恢复 `ready`。
5. 恢复演练：先用 `GET` 确认原 `days/updatedAt`，再刷新失败年；不得通过清空缓存表“修复”。升级前备份参照 `backend/docs/employee-client-contracts.md` 的迁移/回退章节。
