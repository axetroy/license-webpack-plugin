# License Webpack Plugin 设计白皮书

## 1. 项目背景

现代 JavaScript 应用通常依赖大量第三方开源组件。对于商业软件、Electron 应用、桌面软件以及企业级 Web 应用，通常需要在最终发布时提供第三方许可证（Third-Party Licenses）或 Open Source Notices，以满足 MIT、Apache、BSD 等开源协议的要求。

目前已有 `license-checker-rseidelsohn` 可以扫描 Node.js 项目依赖，并生成许可证信息，但其输出对象是整个 Node.js 项目的依赖集合，而不是**最终实际进入 Webpack Bundle 的依赖**。

因此，本项目设计一个 Webpack 插件，在构建结束后：

* 自动识别最终 Bundle 实际使用的第三方依赖
* 查询对应 License 信息
* 生成符合商业软件发布要求的 License 文件
* 支持 License 合规检查（CI）
* 支持多种输出格式

插件定位为：

> **Build-time Third-party License Generator**

---

# 2. 设计目标

## 核心目标

插件必须能够：

* 自动扫描最终 Bundle 使用的 Package
* 自动读取对应 License
* 输出 Third Party Licenses
* 无需修改业务代码
* 与 Webpack 生命周期完全融合

---

## 非目标

插件不负责：

* 解析源码 License Header
* 修改源码
* 分析 npm Registry
* 下载 License
* 管理 SPDX 数据库

上述能力全部交由 `license-checker-rseidelsohn` 完成。

---

# 3. 总体架构

```
                  Webpack Compiler
                         │
                         ▼
                 Compilation Finished
                         │
                         ▼
                Package Scanner
                         │
                         ▼
              Used Package Collection
                         │
                         ▼
          LicenseChecker Adapter
                         │
                         ▼
               License Database
                         │
                         ▼
               License Filtering
                         │
                         ▼
                  Formatter
                         │
                         ▼
                 emitAsset()
                         │
                         ▼
                 Licenses.txt
```

整个插件遵循单向数据流。

Scanner 不依赖 Formatter。

Formatter 不依赖 Webpack。

LicenseChecker 独立封装。

---

# 4. 模块划分

```
src/

    index.ts

    LicenseWebpackPlugin.ts

    scanner/

        PackageScanner.ts

        PackageResolver.ts

    checker/

        LicenseDatabase.ts

        LicenseCache.ts

    formatter/

        TxtFormatter.ts

        JsonFormatter.ts

        MarkdownFormatter.ts

        HtmlFormatter.ts

    model/

        PackageInfo.ts

        LicenseInfo.ts

    utils/

        fs.ts

        hash.ts

        path.ts
```

所有模块职责单一。

---

# 5. 生命周期设计

插件采用 Webpack 官方推荐生命周期。

```
Compiler

↓

thisCompilation

↓

processAssets

↓

emitAsset
```

Scanner 在所有 Module 构建完成后运行。

License 文件作为额外 Asset 输出。

不会影响 Chunk Hash。

不会修改 Bundle 内容。

---

# 6. Package Scanner

Scanner 是整个插件最重要的模块。

其唯一职责：

> 找出最终 Bundle 真正使用了哪些 npm Package。

输入：

```
Compilation
```

输出：

```
Package Set
```

例如：

```
react

react-dom

scheduler

lodash

axios
```

Scanner 不关心 License。

Scanner 不关心输出格式。

---

# 7. Package Resolver

Webpack Module Resource：

```
.../node_modules/react/index.js
```

需要转换为：

```
Package Name

react
```

Resolver 负责解析：

```
普通 npm

pnpm

Yarn

Yarn PnP

Workspace

npm link

file:
```

最终统一输出：

```
PackageInfo

name

version

packageRoot

packageJsonPath
```

Resolver 不依赖路径字符串规则。

统一采用：

向父目录递归查找 package.json。

直到找到真正 Package Root。

---

# 8. License Database

License Database 是对

license-checker-rseidelsohn

的一层封装。

职责：

一次扫描。

缓存全部 Package License。

之后所有查询均来自内存。

```
Package

↓

LicenseDatabase

↓

LicenseInfo
```

License Database 不参与输出。

仅提供查询能力。

---

# 9. 数据模型

## PackageInfo

```
name

version

repository

homepage

author

publisher

path

chunks

modules
```

---

## LicenseInfo

```
license

licenseFile

licenseText

repository

homepage

author

publisher

private

packageJson
```

---

## OutputItem

```
PackageInfo

+

LicenseInfo
```

供 Formatter 使用。

---

# 10. Formatter

Formatter 采用策略模式。

统一接口：

```
generate(items)

↓

string
```

不同 Formatter：

```
TXT

JSON

Markdown

HTML
```

所有 Formatter 共用同一份数据。

不得重新扫描 Package。

---

# 11. TXT 输出规范

默认输出：

```
Third Party Licenses

====================================

Package

Version

License

Repository

License File

License Text

====================================
```

License Text 可配置关闭。

---

# 12. Markdown 输出规范

```
# Third Party Licenses

| Package | Version | License |
|---------|----------|----------|
```

适用于 GitHub。

适用于 Release。

---

# 13. HTML 输出规范

HTML 用于：

Electron

桌面软件

帮助页面

About 对话框

支持：

目录

折叠 License

搜索

License 分类

---

# 14. JSON 输出规范

JSON 用于：

CI

自动审核

License Portal

IDE 插件

格式：

```
[
    {
        "name":"",
        "version":"",
        "license":""
    }
]
```

---

# 15. License 去重

很多 Package：

```
MIT
```

License Text 完全一致。

默认采用去重算法：

```
License Text

↓

Hash

↓

Package List
```

输出：

```
MIT License

Packages

react

scheduler

prop-types
```

避免几十份重复 License。

可配置关闭。

---

# 16. Chunk Mapping

插件可以记录：

```
Renderer

↓

react

antd

axios
```

以及：

```
Main

↓

electron

fs-extra
```

便于：

Electron

代码拆分

商业 License 审计。

---

# 17. Monorepo 支持

支持：

```
packages/

apps/

libs/
```

支持：

```
pnpm workspace

Yarn Workspace

npm Workspace
```

最终仅统计：

真正进入 Bundle 的 Package。

---

# 18. 缓存设计

首次构建：

```
license-checker

↓

License Database
```

缓存：

```
lock file hash

+

package.json hash
```

Watch 模式：

若依赖未变化。

直接复用缓存。

无需重新扫描。

---

# 19. License 合规检查

支持：

```
onlyAllow
```

例如：

```
MIT

Apache-2.0

BSD-3-Clause
```

若发现：

```
GPL

AGPL
```

立即终止构建。

支持：

```
failOn
```

用于 CI。

---

# 20. 插件配置

```
filename

format

includeLicenseText

includeRepository

includeHomepage

includeAuthor

includePackages

excludePackages

includeLicenses

excludeLicenses

onlyAllow

failOn

includeChunks

sort

deduplicateLicense

cache

workspaceRoot
```

所有配置均可选。

---

# 21. 性能设计

整个插件仅进行一次：

Package 扫描。

License 扫描。

之后：

Formatter 共用内存数据。

所有查询均为 O(1)。

避免重复访问磁盘。

License 去重采用 HashMap。

Package 查询采用 Map。

整体复杂度：

```
O(Module)

+

O(Package)
```

能够支持数千个 Module。

---

# 22. 错误处理

对于单个 Package：

License 缺失：

记录 Warning。

Package.json 损坏：

跳过。

License 无法识别：

输出 UNKNOWN。

整个插件不得因为单个 Package 导致构建失败。

只有：

```
onlyAllow

failOn
```

触发时才中断构建。

---

# 23. 扩展能力

插件设计遵循开放封闭原则。

未来可增加：

* SPDX 报告输出
* CycloneDX SBOM 输出
* SPDX JSON 输出
* SPDX Tag-Value 输出
* NOTICE 文件生成
* 第三方声明生成
* PDF License Book
* DOCX License Report
* 企业 License Portal 集成
* 自定义 Formatter
* 自定义 Package Resolver
* 自定义 License Provider
* Webpack MultiCompiler 聚合输出
* Rollup、Rspack、Vite 等 Bundler 的适配层

无需修改现有 Scanner、Database 或 Formatter 核心逻辑。

---

# 24. 设计原则

本插件遵循以下设计原则：

* **单一职责原则（SRP）**：扫描、解析、许可证查询、格式化、输出均为独立模块。
* **开放封闭原则（OCP）**：通过策略接口扩展新的输出格式、许可证来源和包解析方式，而无需修改核心流程。
* **最小依赖原则**：许可证识别完全委托给 `license-checker-rseidelsohn`，插件自身不重复实现 SPDX 或 License 识别逻辑。
* **构建无侵入**：不修改源码、不修改 Bundle、不影响 Chunk Hash，仅新增构建产物。
* **可观测性**：提供构建统计、警告和错误信息，便于 CI/CD 和开发者定位问题。
* **可维护性**：采用清晰的数据模型与模块边界，使各模块能够独立测试与演进。

---

# 25. 总结

License Webpack Plugin 的核心目标是**将 Webpack 的模块图与 `license-checker-rseidelsohn` 的许可证扫描能力结合**，生成准确反映最终构建产物所使用第三方依赖的许可证清单。

其工作流程可概括为：

```
Webpack Module Graph
        │
        ▼
  Package Scanner
        │
        ▼
 Used Package Set
        │
        ▼
license-checker-rseidelsohn
        │
        ▼
 License Database
        │
        ▼
 License Filter
        │
        ▼
    Formatter
        │
        ▼
Licenses.txt / JSON / Markdown / HTML
```

通过模块化设计、缓存机制、多格式输出、License 去重、Monorepo 支持及合规校验等能力，该插件能够满足从个人项目到企业级商业软件发布的开源许可证管理需求，并为未来扩展至 SBOM、SPDX、CycloneDX 等软件供应链场景奠定基础。
gg
