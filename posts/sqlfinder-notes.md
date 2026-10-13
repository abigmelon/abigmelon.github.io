# SQLFINDER 项目介绍与工作流程

## 目录

- [1. 项目概述](#1-项目概述)
- [2. 为什么要开发这个项目？](#2-为什么要开发这个项目)
- [3. 技术栈与项目结构](#3-技术栈与项目结构)
- [4. 具体工作流程](#4-具体工作流程)
- [5. 核心代码链路](#5-核心代码链路)

## 1. 项目概述

SQLFINDER 是一个面向受限业务数据场景开发的自然语言问数平台。用户可以通过自然语言描述业务问题，系统结合当前账号授权的 MySQL 表结构调用大语言模型生成 SQL。生成的 SQL 经过服务端安全校验后，再由只读账号执行查询，最后以表格和图表的形式展示结果。

## 2. 为什么要开发这个项目？

### 降低数据查询门槛

传统的数据查询要求用户了解数据库表结构和 SQL 语法，遇到复杂问题时还可能需要开发人员协助。SQLFINDER 希望让用户直接使用自然语言查询数据，降低数据库查询的使用门槛。

### 提高查询效率

对于重复性的统计、筛选和汇总需求，人工编写 SQL 会占用较多时间。通过大语言模型自动生成 SQL，可以缩短从提出问题到获得结果的时间。

### 探索模型生成 SQL 的安全控制

大语言模型生成的 SQL 不能直接执行，可能存在越权访问数据表、执行不被允许的写操作等风险。因此，项目加入了表权限、SQL 语法树校验、只读账号、查询超时和结果行数限制等机制，探索如何让自然语言问数更加可控。

### 形成可验证、可扩展的问数原型

项目不仅关注“能不能生成 SQL”，还验证了身份认证、权限控制、查询执行、历史会话、结果展示和异常处理等完整流程，为后续扩展字段权限、自动纠错和更复杂的数据分析功能提供基础。

## 3. 技术栈与项目结构

### 技术栈

| 类别 | 技术 |
| --- | --- |
| 后端语言 | Java 17 |
| 后端框架 | Spring Boot 3.4 |
| 安全认证 | Spring Security、Session、BCrypt、CSRF |
| 数据访问 | JDBC、HikariCP |
| 业务数据库 | MySQL |
| 本地历史存储 | H2 |
| SQL 解析 | JSqlParser 5.3 |
| 大语言模型 | DeepSeek API |
| 前端 | 原生 HTML、CSS、JavaScript |
| 数据可视化 | ECharts |
| 构建工具 | Maven |

项目运行时页面由 Spring Boot 直接提供静态资源，前端不依赖 React 或 Vue。Node.js 和 Playwright 主要用于浏览器自动化测试。

### 项目整体结构

用户在问数工作台中输入问题，后端读取当前用户有权限访问的数据库结构，请求模型生成 SQL。生成的 SQL 会经过服务端校验，确认符合查询规则后，再使用只读账号访问 MySQL。最终结果返回到前端，以表格或图表形式展示；问题、SQL 和结果摘要还可以保存，便于后续查看和继续追问。

### 主要目录

| 目录或文件 | 作用 |
| --- | --- |
| `sqlfinder-server` | 项目主体，包含后端程序、网页资源、配置和测试 |
| `src/main/java` | 后端业务代码，负责接口、问数流程、权限、SQL 校验、数据库访问和模型调用 |
| `src/main/resources/static` | 前端页面，包括登录页、问数工作台、设置页、样式、脚本和图表资源 |
| `src/main/resources/db` | 本地历史记录所需的数据表结构 |
| `src/test` | 后端测试、前端测试和集成测试 |
| `scripts` | 启动、打包、备份和恢复脚本 |
| `samples` | 示例数据库和参考查询 |
| `docs` | 项目手册、设计说明、验证记录和历史资料 |
| `references` | 项目参考材料 |
| `README.md` | 项目总体说明和快速启动文档 |

## 4. 具体工作流程

### 4.1 应用启动

程序入口是 `SqlFinderApplication.java`。

- 普通启动时，调用 `SpringApplication.run(...)` 启动 Spring Boot。
- 如果带有 `--configure-login` 参数，则进入 `LoginSetup`，只初始化登录账号，不启动完整服务。
- Spring Boot 读取 YAML、环境变量和本地配置，创建数据库连接、业务组件、安全配置和静态资源服务。

### 4.2 浏览器加载前端

用户打开首页后，Spring Boot 直接返回 `static` 目录下的页面。页面主要由以下文件组成：

- `index.html`：问数工作台结构；
- `app.js`：页面交互和接口调用；
- `styles.css`、`chat.css`：页面样式；
- `charts.js` 和 ECharts：图表展示。

前端初始化时会检查当前登录状态、读取 CSRF Token、获取 SQL 策略、获取授权表结构，并加载历史会话。

### 4.3 用户登录

登录请求发送到 `/api/auth/login`。`SecurityConfig.java` 负责：

- 校验用户名和 BCrypt 密码；
- 创建 Session；
- 返回 `JSESSIONID`；
- 对后续写操作执行 CSRF 校验；
- 根据用户角色限制设置页面和其他接口的访问权限。

### 4.4 用户提交问题

用户在问数页面输入问题，例如“查询销售额最高的商铺”。前端 `app.js` 监听表单提交，并向 `/api/chat/question` 发送 JSON。

请求中除了问题文本，还可能包含：

- 是否新建对话；
- 是否基于上一轮继续追问；
- 是否重新生成上一轮回答；
- 前置轮次的 ID。

### 4.5 请求进入控制器

请求首先经过 Spring Security 和 CSRF 检查，然后进入 `ChatController.java`。

`ChatController` 不直接处理具体业务，而是负责：

- 接收和校验请求参数；
- 获取当前登录用户；
- 生成或读取请求 ID；
- 创建工作流状态；
- 把请求交给 `QuestionOrchestrator`。

### 4.6 读取用户可访问的表结构

`QuestionOrchestrator` 首先调用 `UserMetadataService`。

该服务会把“系统允许使用的表”和“当前用户拥有权限的表”进行交集计算，然后通过 `JdbcMetadataService` 读取这些表的字段名、字段类型、是否可为空以及字段注释。

这样，模型只能看到用户有权访问的数据库结构，而不会接触整个数据库的表信息。

### 4.7 处理会话上下文

接下来，`ConversationStore` 判断当前请求属于哪种模式：

- 新建对话；
- 继续追问；
- 重新生成上一轮回答。

如果是连续对话，系统会检查前置轮次是否属于当前用户、表结构是否发生变化、上下文是否过期，然后提取有限的历史摘要作为模型上下文。

### 4.8 构造模型提示词

`PromptBuilder.java` 将以下内容组合成模型输入：

- 系统规则；
- 当前用户问题；
- 授权表结构；
- 对话上下文；
- 允许使用的 SQL 函数和查询限制。

系统要求模型只生成单条、只读的 MySQL `SELECT` 查询；如果信息不足，则返回澄清信息。

### 4.9 调用 DeepSeek

`DeepSeekLlmClient` 通过 HTTP 调用 DeepSeek API，发送提示词和模型配置。

模型返回后，`ModelOutputParser` 会严格解析返回内容，要求它符合项目约定的 JSON 格式，例如：

- 是否生成成功；
- 生成的 SQL；
- 面向用户的说明或澄清信息。

如果模型无法确定查询条件，系统会返回 `NEEDS_CLARIFICATION`，不会继续执行数据库查询。

### 4.10 校验 SQL

如果模型生成了 SQL，系统会交给 `SqlValidator`。它大致分为两层：

- `SqlLexicalGuard`：检查注释、引号、变量、分号和危险关键字等文本层面问题；
- `SqlAstGuard`：使用 JSqlParser 把 SQL 解析成语法树，检查真实表引用、查询类型、函数、表达式和复杂度。

校验器会拒绝：

- `INSERT`、`UPDATE`、`DELETE` 等写操作；
- 多条 SQL；
- 未授权表；
- 不支持的语法；
- 超出策略限制的查询。

### 4.11 根据执行开关决定是否查询

如果只开启 SQL 验证，系统会返回 `SQL_VALIDATED`，只展示生成并通过检查的 SQL。

如果开启查询执行，则进入 `JdbcQueryExecutor`。

### 4.12 执行前再次检查

查询执行器不会直接使用前面的校验结果，而是重新读取当前用户的授权表结构，并再次校验 SQL。

这样可以避免用户权限或数据库配置在生成 SQL 之后发生变化，保证真正执行时仍然符合当前权限。

### 4.13 以只读方式查询 MySQL

`JdbcQueryExecutor` 使用 JDBC 连接 MySQL，并执行以下限制：

- 只读事务；
- 查询超时；
- 最大返回行数；
- 单个字段和整体结果大小限制；
- 资源关闭和事务回滚；
- 支持请求取消。

查询结果会被转换成统一的 `QueryResult`，包含列名、数据行、字段类型和是否被截断等信息。

### 4.14 保存会话和结果

`ConversationStore` 将问题、生成的 SQL、校验摘要、状态和已返回的结果快照保存到本地 H2 历史库。

因此，用户刷新页面或重新启动服务后，仍然可以查看历史回答。历史记录只属于创建它的用户；如果表结构发生变化，旧上下文不会继续用于生成新 SQL。

### 4.15 返回统一响应

`QuestionOrchestrator` 将处理结果封装为 `AnswerResponse`，可能的状态包括：

- `NEEDS_CLARIFICATION`：需要用户补充信息；
- `SQL_VALIDATED`：SQL 已校验但未执行；
- `QUERY_SUCCEEDED`：查询成功；
- `SQL_REJECTED`：SQL 不符合规则；
- `QUERY_FAILED`：查询执行失败。

`ChatController` 最后补充请求 ID、会话 ID 和轮次 ID，将结果以 JSON 返回给浏览器。

### 4.16 前端展示结果

`app.js` 根据响应状态更新页面：

- 显示用户问题和系统回答；
- 折叠展示 SQL；
- 以表格展示查询结果；
- 支持搜索、分页和 CSV 导出；
- 根据字段类型生成柱状图、折线图或饼图；
- 保存当前回答并更新历史会话列表。

## 5. 核心代码链路

一次完整问数请求的核心代码链路如下：

```text
app.js
  → ChatController
  → QuestionOrchestrator
  → UserMetadataService
  → PromptBuilder
  → DeepSeekLlmClient
  → ModelOutputParser
  → SqlValidator
  → JdbcQueryExecutor
  → ConversationStore
```

其中，`QuestionOrchestrator` 是整个流程的核心编排器，负责按照固定顺序连接各个模块；各个具体模块分别负责表结构读取、模型调用、SQL 校验、数据库查询和历史记录保存。

