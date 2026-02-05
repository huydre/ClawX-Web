# ClawX 项目架构与版本大纲

> 基于 OpenClaw 的图形化 AI 助手应用  
> 技术栈：Electron + React + TypeScript
> 代码规范：全部英文注释、
> 开发规范：每一个模块开发完成后，写好完整单测，在{project}/build_process/目录中，更新proecess.md, 增加当前feature.md文档(保持commit_X_feat.md格式)，提交commit。
> 图形支持语言：与openClaw保持一致
> 如果有疑问请重新参考当前文档

---

## 一、项目概述

### 1.1 项目定位

**ClawX** 是 OpenClaw 的图形化封装层，旨在提供：

- 🎯 **零命令行体验** - 通过 GUI 完成所有安装、配置和使用
- 🎨 **现代化 UI** - 美观、直观的桌面应用界面
- 📦 **开箱即用** - 预装精选技能包，即刻可用
- 🖥️ **跨平台** - macOS / Windows / Linux 统一体验
- 🔄 **无缝集成** - 与 OpenClaw 生态完全兼容

### 1.2 目标用户

| 用户群体 | 痛点 | ClawX 解决方案 |
|----------|------|----------------|
| 非技术用户 | 命令行恐惧 | 可视化安装向导 |
| 效率追求者 | 配置繁琐 | 一键预设技能包 |
| 跨平台用户 | 体验不一致 | 统一 UI 设计语言 |
| AI 尝鲜者 | 门槛高 | 引导式 onboarding |

### 1.3 与 OpenClaw 的关系

```
┌─────────────────────────────────────────────────────────┐
│                     ClawX App                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Electron Main Process                          │   │
│  │  - 窗口管理、系统托盘、自动更新                    │   │
│  │  - Gateway 进程管理                              │   │
│  │  - Node.js 环境检测/安装                         │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  React Renderer Process                         │   │
│  │  - 现代化 UI 界面                                │   │
│  │  - WebSocket 通信层                             │   │
│  └─────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────┘
                         │ WebSocket (JSON-RPC)
                         ▼
┌─────────────────────────────────────────────────────────┐
│              OpenClaw Gateway (上游)                     │
│  - 消息通道管理 (WhatsApp/Telegram/Discord...)          │
│  - AI Agent 运行时                                      │
│  - 技能/插件系统                                        │
└─────────────────────────────────────────────────────────┘
```

**核心原则**：
- ✅ **封装而非 Fork** - 通过 npm 依赖引入 openclaw
- ✅ **不修改上游** - 所有定制通过配置、插件实现
- ✅ **版本绑定** - 每个 ClawX 版本绑定特定 openclaw 版本
- ✅ **CLI 兼容** - 命令行保持 `openclaw` 命令，不引入 `clawx` CLI

openclaw project remote: https://github.com/openclaw/openclaw
### 1.4 CLI 兼容性设计

ClawX 是 OpenClaw 的**图形化增强层**，而非替代品。用户可以同时使用 GUI 和 CLI：

```
┌─────────────────────────────────────────────────────────────────┐
│                    ClawX + OpenClaw 共存模式                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   用户交互方式                                                   │
│   ┌─────────────────────┐    ┌─────────────────────┐           │
│   │    ClawX GUI        │    │   openclaw CLI      │           │
│   │    (图形界面)        │    │   (命令行)          │           │
│   │                     │    │                     │           │
│   │  • 点击操作          │    │  • openclaw doctor  │           │
│   │  • 可视化配置        │    │  • openclaw plugins │           │
│   │  • 安装向导          │    │  • openclaw config  │           │
│   │  • 普通用户首选      │    │  • 高级用户/脚本    │           │
│   └──────────┬──────────┘    └──────────┬──────────┘           │
│              │                          │                       │
│              └────────────┬─────────────┘                       │
│                           ▼                                     │
│              ┌─────────────────────────┐                       │
│              │   OpenClaw Gateway      │                       │
│              │   (共享同一实例)         │                       │
│              └─────────────────────────┘                       │
│                           │                                     │
│              ┌────────────┴────────────┐                       │
│              ▼                         ▼                       │
│   ┌─────────────────────┐   ┌─────────────────────┐           │
│   │  ~/.openclaw/       │   │  OpenClaw 配置/数据  │           │
│   │  (共享配置目录)      │   │  (技能/插件/会话)    │           │
│   └─────────────────────┘   └─────────────────────┘           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### CLI 兼容性原则

| 原则 | 说明 |
|------|------|
| **命令一致** | 使用 `openclaw` 命令，不引入 `clawx` CLI |
| **配置共享** | GUI 和 CLI 共享 `~/.openclaw/` 配置目录 |
| **Gateway 共享** | GUI 和 CLI 连接同一个 Gateway 实例 |
| **功能互补** | GUI 简化常用操作，CLI 支持高级/自动化场景 |

#### 用户使用场景

**场景 A: 纯 GUI 用户 (新手)**
```
1. 安装 ClawX.app
2. 通过安装向导完成配置
3. 日常使用 GUI 界面
4. 无需接触命令行
```

**场景 B: GUI + CLI 混合用户 (进阶)**
```
1. 安装 ClawX.app (自动包含 openclaw CLI)
2. 日常使用 GUI 界面
3. 需要时打开终端使用 CLI:
   - openclaw doctor        # 健康检查
   - openclaw plugins list  # 查看插件
   - openclaw config get    # 查看配置
```

**场景 C: CLI 优先用户 (开发者)**
```
1. 安装 ClawX.app 或单独安装 openclaw CLI
2. 主要使用命令行操作
3. 偶尔打开 GUI 查看状态或配置复杂选项
```

#### ClawX 安装时的 CLI 处理

```typescript
// electron/installer/cli-setup.ts

/**
 * ClawX 安装时确保 openclaw CLI 可用
 * 不创建 clawx 命令，保持与上游一致
 */
export async function ensureOpenClawCli(): Promise<void> {
  const isInstalled = await checkCliInstalled('openclaw');
  
  if (!isInstalled) {
    // 通过 npm 全局安装 openclaw
    await privilegeManager.execAsAdmin(
      'npm install -g openclaw',
      { reason: '安装 OpenClaw 命令行工具' }
    );
  }
  
  // 确保 PATH 包含 npm 全局目录
  await pathManager.ensureNpmGlobalPath();
  
  // 验证安装
  const version = await exec('openclaw --version');
  console.log(`OpenClaw CLI installed: ${version}`);
}

/**
 * ClawX 不创建自己的 CLI 命令
 * 所有命令行操作都通过 openclaw 完成
 */
// ❌ 不会有 clawx CLI
// ✅ 只有 openclaw CLI
```

#### GUI 与 CLI 的功能映射

| 操作 | ClawX GUI | openclaw CLI |
|------|-----------|--------------|
| 健康检查 | 设置 → 诊断 → 运行检查 | `openclaw doctor` |
| 安装插件 | 技能市场 → 安装 | `openclaw plugins install <name>` |
| 查看配置 | 设置 → 高级 | `openclaw config get` |
| 修改配置 | 设置页面表单 | `openclaw config set <key> <value>` |
| 查看状态 | Dashboard | `openclaw status` |
| 查看日志 | 设置 → 日志 | `openclaw logs` |
| 连接通道 | 通道 → 添加 → 扫码 | `openclaw channels add whatsapp` |
| 发送消息 | 对话界面 | `openclaw message send <target> <msg>` |

#### 开发者模式: 终端集成

```typescript
// src/pages/Settings/DeveloperSettings.tsx

export function DeveloperSettings() {
  const openTerminal = async () => {
    // 在内置终端或系统终端中打开，预设好环境
    await window.electron.ipcRenderer.invoke('terminal:open', {
      cwd: '~/.openclaw',
      env: {
        // 确保 openclaw 命令可用
        PATH: `${process.env.PATH}:${npmGlobalBinPath}`,
      },
    });
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>开发者工具</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 快捷命令按钮 */}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => runCommand('openclaw doctor')}>
            <Terminal className="w-4 h-4 mr-2" />
            运行健康检查
          </Button>
          <Button variant="outline" onClick={() => runCommand('openclaw status --all')}>
            <Activity className="w-4 h-4 mr-2" />
            查看完整状态
          </Button>
          <Button variant="outline" onClick={() => runCommand('openclaw plugins list')}>
            <Puzzle className="w-4 h-4 mr-2" />
            列出插件
          </Button>
          <Button variant="outline" onClick={() => runCommand('openclaw config get')}>
            <Settings className="w-4 h-4 mr-2" />
            查看配置
          </Button>
        </div>
        
        <Separator />
        
        {/* 打开终端 */}
        <Button variant="outline" className="w-full" onClick={openTerminal}>
          <Terminal className="w-4 h-4 mr-2" />
          打开终端 (已配置 openclaw 环境)
        </Button>
        
        <p className="text-xs text-muted-foreground">
          ClawX 与 OpenClaw CLI 完全兼容，您可以在终端中使用 <code>openclaw</code> 命令进行高级操作。
        </p>
      </CardContent>
    </Card>
  );
}
```

#### 配置同步机制

```typescript
// electron/config/sync.ts

/**
 * ClawX 和 openclaw CLI 共享同一配置文件
 * 任何一方的修改都会实时反映到另一方
 */
export class ConfigSync {
  private configPath = join(homedir(), '.openclaw', 'config.json');
  private watcher: FSWatcher | null = null;
  
  /**
   * 监听配置文件变化 (CLI 修改时同步到 GUI)
   */
  startWatching(): void {
    this.watcher = watch(this.configPath, async () => {
      const config = await this.readConfig();
      // 通知渲染进程配置已更新
      mainWindow?.webContents.send('config:updated', config);
    });
  }
  
  /**
   * GUI 修改配置时，写入共享配置文件 (CLI 可读取)
   */
  async updateConfig(updates: Partial<OpenClawConfig>): Promise<void> {
    const current = await this.readConfig();
    const merged = deepMerge(current, updates);
    await writeFile(this.configPath, JSON.stringify(merged, null, 2));
  }
  
  /**
   * 配置文件位置说明
   * 
   * ~/.openclaw/
   * ├── config.json      # 主配置 (GUI 和 CLI 共享)
   * ├── credentials/     # 凭证存储
   * ├── sessions/        # 会话数据
   * └── skills/          # 用户技能
   * 
   * ~/.clawx/
   * ├── presets.json     # ClawX 专属配置 (技能包选择等)
   * └── ui-state.json    # GUI 状态 (窗口位置等)
   */
}
```

---

## 二、技术架构

### 2.1 技术栈选型

| 层级 | 技术 | 版本 | 选型理由 |
|------|------|------|----------|
| **运行时** | Electron | 33+ | 跨平台、嵌入 Node.js |
| **前端框架** | React | 19 | 生态丰富、hooks 模式 |
| **UI 组件** | shadcn/ui | latest | 可定制、现代设计 |
| **样式** | Tailwind CSS | 4.x | 原子化、快速开发 |
| **状态管理** | Zustand | 5.x | 轻量、TypeScript 友好 |
| **路由** | React Router | 7.x | 声明式、嵌套路由 |
| **构建工具** | Vite | 6.x | 极速 HMR |
| **打包工具** | electron-builder | latest | 多平台打包、自动更新 |
| **测试** | Vitest + Playwright | latest | 单元测试 + E2E |
| **语言** | TypeScript | 5.x | 类型安全 |

### 2.2 双端口架构与开发者模式

ClawX 采用**双端口分层架构**，区分普通用户界面与开发者管理后台：

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户访问入口                              │
├─────────────────────────────┬───────────────────────────────────┤
│                             │                                   │
│   ┌─────────────────────┐   │   ┌─────────────────────────┐    │
│   │   ClawX GUI         │   │   │   OpenClaw Control UI   │    │
│   │   Port: 23333       │   │   │   Port: 18789           │    │
│   │                     │   │   │                         │    │
│   │   🎨 现代化界面      │   │   │   ⚙️ 原生管理后台        │    │
│   │   📦 预装技能包      │──▶│   │   🔧 高级配置           │    │
│   │   🚀 一键安装向导    │   │   │   📊 调试日志           │    │
│   │   👤 普通用户        │   │   │   👨‍💻 开发者/高级用户    │    │
│   └─────────────────────┘   │   └─────────────────────────┘    │
│                             │                                   │
│        [开发者模式] ────────┼──────────────▶                    │
│                             │                                   │
└─────────────────────────────┴───────────────────────────────────┘
                              │
                              │ WebSocket (JSON-RPC)
                              ▼
                 ┌────────────────────────┐
                 │   OpenClaw Gateway     │
                 │   内部服务端口: 18789   │
                 └────────────────────────┘
```

#### 端口分配

| 端口 | 服务 | 用途 | 目标用户 |
|------|------|------|----------|
| **23333** | ClawX GUI | 默认图形化界面 | 所有用户 |
| **18789** | OpenClaw Control UI | Gateway 管理后台 | 开发者/高级用户 |

> **端口选择说明**：
> - `23333` - ClawX 专属端口，易记且不与常见服务冲突
> - `18789` - OpenClaw 原生端口，保持上游兼容

#### 开发者模式入口

```typescript
// src/components/layout/Sidebar.tsx
export function Sidebar() {
  const [devModeClicks, setDevModeClicks] = useState(0);
  
  // 连续点击 5 次版本号解锁开发者模式
  const handleVersionClick = () => {
    const clicks = devModeClicks + 1;
    setDevModeClicks(clicks);
    
    if (clicks >= 5) {
      toast.success('开发者模式已解锁');
      setDevModeClicks(0);
    }
  };
  
  return (
    <aside className="w-64 border-r flex flex-col h-full">
      {/* 导航菜单 */}
      <nav className="flex-1 p-4 space-y-1">
        <NavItem href="/" icon={<Home />} label="概览" />
        <NavItem href="/chat" icon={<MessageSquare />} label="对话" />
        <NavItem href="/channels" icon={<Radio />} label="通道" />
        <NavItem href="/skills" icon={<Puzzle />} label="技能" />
        <NavItem href="/cron" icon={<Clock />} label="定时任务" />
        <NavItem href="/settings" icon={<Settings />} label="设置" />
      </nav>
      
      {/* 底部版本信息 */}
      <footer className="p-4 border-t">
        <button onClick={handleVersionClick} className="text-xs text-muted">
          ClawX v1.0.0
        </button>
        
        {/* 开发者模式入口 - 解锁后显示 */}
        {isDevModeUnlocked && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.electron.openExternal('http://localhost:18789')}
          >
            <Terminal className="w-4 h-4 mr-2" />
            开发者模式
          </Button>
        )}
      </footer>
    </aside>
  );
}
```

#### 设置页面快捷入口

```typescript
// src/pages/Settings/AdvancedSettings.tsx
export function AdvancedSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>高级设置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 其他设置项 */}
        
        <Separator />
        
        {/* 开发者工具区域 */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">开发者工具</Label>
          <p className="text-xs text-muted-foreground">
            访问 OpenClaw 原生管理后台，进行高级配置和调试
          </p>
          <Button
            variant="outline"
            onClick={() => window.electron.openExternal('http://localhost:18789')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            打开 OpenClaw 管理后台
          </Button>
          <p className="text-xs text-muted-foreground">
            将在浏览器中打开 http://localhost:18789
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

#### 配置文件

```typescript
// electron/utils/config.ts
export const PORTS = {
  /** ClawX 默认 GUI 端口 */
  CLAWX_GUI: 23333,
  
  /** OpenClaw Gateway 端口 (上游默认) */
  OPENCLAW_GATEWAY: 18789,
} as const;

// 环境变量覆盖
export function getPort(key: keyof typeof PORTS): number {
  const envKey = `CLAWX_PORT_${key}`;
  const envValue = process.env[envKey];
  return envValue ? parseInt(envValue, 10) : PORTS[key];
}
```

#### 使用场景对比

| 场景 | ClawX GUI (23333) | OpenClaw 后台 (18789) |
|------|-------------------|----------------------|
| 日常对话 | ✅ | ❌ |
| 查看消息记录 | ✅ | ✅ |
| 添加/管理通道 | ✅ (简化版) | ✅ (完整版) |
| 安装技能包 | ✅ | ❌ |
| 编辑技能配置 | ❌ | ✅ |
| 查看原始日志 | ❌ | ✅ |
| 插件管理 | ❌ | ✅ |
| JSON 配置编辑 | ❌ | ✅ |
| WebSocket 调试 | ❌ | ✅ |
| Cron 任务管理 | ✅ | ✅ |

### 2.3 目录结构

```
clawx/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml              # 持续集成
│   │   ├── release.yml         # 自动发布
│   │   └── test.yml            # 测试流水线
│   └── ISSUE_TEMPLATE/
│
├── electron/                    # Electron 主进程
│   ├── main/
│   │   ├── index.ts            # 主入口
│   │   ├── window.ts           # 窗口管理
│   │   ├── tray.ts             # 系统托盘
│   │   ├── menu.ts             # 原生菜单
│   │   └── ipc-handlers.ts     # IPC 处理器
│   │
│   ├── updater/                 # 自动更新模块
│   │   ├── index.ts            # 更新管理器入口
│   │   ├── checker.ts          # 版本检查器
│   │   ├── downloader.ts       # 下载管理
│   │   ├── notifier.ts         # 更新通知
│   │   └── channels.ts         # 更新通道配置
│   │
│   ├── gateway/
│   │   ├── manager.ts          # Gateway 进程生命周期
│   │   ├── client.ts           # WebSocket 客户端
│   │   ├── protocol.ts         # JSON-RPC 协议定义
│   │   └── health.ts           # 健康检查
│   │
│   ├── installer/
│   │   ├── node-installer.ts   # Node.js 自动安装
│   │   ├── openclaw-installer.ts # openclaw npm 安装
│   │   ├── skill-installer.ts  # 技能包安装
│   │   └── platform/
│   │       ├── darwin.ts       # macOS 特定逻辑
│   │       ├── win32.ts        # Windows 特定逻辑
│   │       └── linux.ts        # Linux 特定逻辑
│   │
│   ├── privilege/               # 权限提升模块
│   │   ├── index.ts            # 统一权限管理器
│   │   ├── darwin-admin.ts     # macOS 管理员权限 (osascript)
│   │   ├── win32-admin.ts      # Windows UAC 提升
│   │   └── linux-admin.ts      # Linux pkexec/polkit
│   │
│   ├── env-config/              # 环境配置模块
│   │   ├── index.ts            # 环境配置管理器
│   │   ├── path-manager.ts     # PATH 环境变量管理
│   │   ├── api-keys.ts         # API Key 安全存储
│   │   └── shell-profile.ts    # Shell 配置文件管理
│   │
│   ├── preload/
│   │   └── index.ts            # 预加载脚本 (contextBridge)
│   │
│   └── utils/
│       ├── logger.ts           # 日志
│       ├── paths.ts            # 路径管理
│       └── store.ts            # 持久化存储 (electron-store)
│
├── src/                         # React 渲染进程
│   ├── main.tsx                # React 入口
│   ├── App.tsx                 # 根组件
│   │
│   ├── pages/                  # 页面组件
│   │   ├── Dashboard/
│   │   │   ├── index.tsx
│   │   │   ├── StatusCard.tsx
│   │   │   └── QuickActions.tsx
│   │   ├── Chat/
│   │   │   ├── index.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── InputArea.tsx
│   │   │   └── ToolCallCard.tsx
│   │   ├── Channels/
│   │   │   ├── index.tsx
│   │   │   ├── ChannelCard.tsx
│   │   │   └── QRScanner.tsx
│   │   ├── Skills/
│   │   │   ├── index.tsx
│   │   │   ├── SkillCard.tsx
│   │   │   ├── SkillMarket.tsx
│   │   │   └── BundleSelector.tsx
  │   │   ├── Cron/                  # 定时任务
│   │   │   ├── index.tsx         # 任务列表页
│   │   │   ├── CronJobCard.tsx   # 任务卡片组件
│   │   │   ├── CronEditor.tsx    # 任务编辑器
│   │   │   ├── CronSchedulePicker.tsx # Cron 表达式选择器
│   │   │   └── CronHistory.tsx   # 执行历史
│   │   ├── Settings/
│   │   │   ├── index.tsx
│   │   │   ├── GeneralSettings.tsx
│   │   │   ├── ProviderSettings.tsx
│   │   │   ├── ChannelsSettings.tsx  # 通道连接配置 (从安装向导移出)
│   │   │   └── AdvancedSettings.tsx
│   │   └── Setup/              # 安装向导 (简化版，不含通道连接)
│   │       ├── index.tsx
│   │       ├── WelcomeStep.tsx
│   │       ├── RuntimeStep.tsx
│   │       ├── ProviderStep.tsx
│   │       └── SkillStep.tsx
│   │
│   ├── components/             # 通用组件
│   │   ├── ui/                 # shadcn/ui 组件
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── MainLayout.tsx
│   │   └── common/
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── StatusBadge.tsx
│   │
│   ├── hooks/                  # 自定义 Hooks
│   │   ├── useGateway.ts       # Gateway 连接状态
│   │   ├── useChannels.ts      # 通道数据
│   │   ├── useSkills.ts        # 技能数据
│   │   ├── useChat.ts          # 聊天会话
│   │   ├── useCron.ts          # 定时任务数据
│   │   └── useElectron.ts      # IPC 通信
│   │
│   ├── stores/                 # Zustand 状态管理
│   │   ├── gateway.ts          # Gateway 状态
│   │   ├── channels.ts         # 通道状态
│   │   ├── chat.ts             # 聊天状态
│   │   ├── skills.ts           # 技能状态
│   │   ├── cron.ts             # 定时任务状态
│   │   └── settings.ts         # 设置状态
│   │
│   ├── services/               # 服务层
│   │   ├── gateway-rpc.ts      # Gateway RPC 调用封装
│   │   ├── skill-service.ts    # 技能服务
│   │   ├── cron-service.ts     # 定时任务服务
│   │   └── update-service.ts   # 更新服务
│   │
│   ├── types/                  # TypeScript 类型定义
│   │   ├── gateway.ts          # Gateway 协议类型
│   │   ├── channel.ts          # 通道类型
│   │   ├── skill.ts            # 技能类型
│   │   ├── cron.ts             # 定时任务类型
│   │   └── electron.d.ts       # Electron API 类型
│   │
│   ├── utils/                  # 工具函数
│   │   ├── format.ts
│   │   └── platform.ts
│   │
│   └── styles/
│       ├── globals.css         # 全局样式
│       └── themes/             # 主题定义
│           ├── light.css
│           └── dark.css
│
├── resources/                   # 静态资源
│   ├── icons/                  # 应用图标
│   │   ├── icon.icns           # macOS
│   │   ├── icon.ico            # Windows
│   │   └── icon.png            # Linux
│   ├── skills/                 # 预装技能包
│   │   ├── productivity.json
│   │   ├── developer.json
│   │   └── smart-home.json
│   └── locales/                # 国际化 (可选)
│       ├── en.json
│       └── zh-CN.json
│
├── scripts/                     # 构建/工具脚本
│   ├── build.ts                # 构建脚本
│   ├── release.ts              # 发布脚本
│   ├── notarize.ts             # macOS 公证
│   └── dev.ts                  # 开发脚本
│
├── tests/                       # 测试
│   ├── unit/                   # 单元测试
│   ├── integration/            # 集成测试
│   └── e2e/                    # E2E 测试
│       ├── setup.spec.ts       # 安装向导测试
│       ├── chat.spec.ts        # 聊天功能测试
│       └── channels.spec.ts    # 通道配置测试
│
├── .env.example                # 环境变量示例
├── .eslintrc.cjs               # ESLint 配置
├── .prettierrc                 # Prettier 配置
├── electron-builder.yml        # 打包配置
├── package.json
├── tsconfig.json               # TypeScript 配置 (主)
├── tsconfig.node.json          # TypeScript 配置 (Node)
├── vite.config.ts              # Vite 配置
├── tailwind.config.js          # Tailwind 配置
├── CHANGELOG.md
├── LICENSE
└── README.md
```

### 2.4 核心模块设计

#### 2.4.1 Gateway 管理器

```typescript
// electron/gateway/manager.ts
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import WebSocket from 'ws';

export interface GatewayStatus {
  state: 'stopped' | 'starting' | 'running' | 'error';
  port: number;
  pid?: number;
  uptime?: number;
  error?: string;
}

export class GatewayManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private ws: WebSocket | null = null;
  private status: GatewayStatus = { state: 'stopped', port: 18789 };
  
  // 启动 Gateway
  async start(): Promise<void> {
    if (this.status.state === 'running') return;
    
    this.setStatus({ state: 'starting' });
    
    try {
      // 检查已有进程
      const existing = await this.findExisting();
      if (existing) {
        await this.connect(existing.port);
        return;
      }
      
      // 启动新进程
      this.process = spawn('openclaw', [
        'gateway', 'run',
        '--port', String(this.status.port),
        '--force'
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
      });
      
      this.process.on('exit', (code) => {
        this.setStatus({ state: 'stopped' });
        this.emit('exit', code);
      });
      
      // 等待就绪并连接
      await this.waitForReady();
      await this.connect(this.status.port);
      
    } catch (error) {
      this.setStatus({ state: 'error', error: String(error) });
      throw error;
    }
  }
  
  // 停止 Gateway
  async stop(): Promise<void> {
    this.ws?.close();
    this.process?.kill();
    this.setStatus({ state: 'stopped' });
  }
  
  // RPC 调用
  async rpc<T>(method: string, params?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Gateway not connected'));
        return;
      }
      
      const id = crypto.randomUUID();
      const handler = (data: WebSocket.Data) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === id) {
          this.ws?.off('message', handler);
          if (msg.error) reject(msg.error);
          else resolve(msg.result as T);
        }
      };
      
      this.ws.on('message', handler);
      this.ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
  }
  
  private setStatus(update: Partial<GatewayStatus>): void {
    this.status = { ...this.status, ...update };
    this.emit('status', this.status);
  }
}
```

#### 2.4.2 安装向导流程

```typescript
// src/pages/Setup/index.tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<StepProps>;
}

const steps: SetupStep[] = [
  {
    id: 'welcome',
    title: '欢迎使用 ClawX',
    description: '您的 AI 助手，即将启程',
    component: WelcomeStep,
  },
  {
    id: 'runtime',
    title: '环境检测',
    description: '检测并安装必要运行环境',
    component: RuntimeStep,
  },
  {
    id: 'provider',
    title: '选择 AI 模型',
    description: '配置您的 AI 服务提供商',
    component: ProviderStep,
  },
  // NOTE: Channel step removed - 通道连接移至 Settings > Channels 页面
  // 用户可在完成初始设置后自行配置消息通道
  // NOTE: Skills selection step removed - 自动安装必要组件
  // 用户无需手动选择，核心组件自动安装
  {
    id: 'installing',
    title: '安装组件',
    description: '正在安装必要的 AI 组件',
    component: InstallingStep,
  },
  {
    id: 'complete',
    title: '设置完成',
    description: '一切就绪，开始使用吧！',
    component: CompleteStep,
  },
];

export function SetupWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [setupData, setSetupData] = useState<SetupData>({});
  
  const step = steps[currentStep];
  const StepComponent = step.component;
  
  const handleNext = (data: Partial<SetupData>) => {
    setSetupData({ ...setupData, ...data });
    setCurrentStep((i) => Math.min(i + 1, steps.length - 1));
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* 进度指示器 */}
      <div className="flex justify-center pt-8">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div className={cn(
              'w-3 h-3 rounded-full transition-colors',
              i <= currentStep ? 'bg-blue-500' : 'bg-slate-600'
            )} />
            {i < steps.length - 1 && (
              <div className={cn(
                'w-12 h-0.5 transition-colors',
                i < currentStep ? 'bg-blue-500' : 'bg-slate-600'
              )} />
            )}
          </div>
        ))}
      </div>
      
      {/* 步骤内容 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="max-w-2xl mx-auto p-8"
        >
          <h1 className="text-3xl font-bold text-white mb-2">{step.title}</h1>
          <p className="text-slate-400 mb-8">{step.description}</p>
          
          <StepComponent
            data={setupData}
            onNext={handleNext}
            onBack={() => setCurrentStep((i) => Math.max(i - 1, 0))}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

#### 2.4.3 预装技能包定义

```typescript
// resources/skills/bundles.ts
export interface SkillBundle {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  icon: string;
  skills: string[];
  recommended?: boolean;
}

export const skillBundles: SkillBundle[] = [
  {
    id: 'productivity',
    name: 'Productivity',
    nameZh: '效率办公',
    description: 'Calendar, reminders, notes, email management',
    descriptionZh: '日历、提醒、笔记、邮件管理',
    icon: '📋',
    skills: [
      'apple-reminders',
      'apple-notes',
      'himalaya',
      'notion',
      'obsidian',
      'trello',
    ],
    recommended: true,
  },
  {
    id: 'developer',
    name: 'Developer Tools',
    nameZh: '开发者工具',
    description: 'GitHub, coding assistant, terminal management',
    descriptionZh: 'GitHub、代码助手、终端管理',
    icon: '💻',
    skills: [
      'github',
      'coding-agent',
      'tmux',
    ],
    recommended: true,
  },
  {
    id: 'smart-home',
    name: 'Smart Home',
    nameZh: '智能家居',
    description: 'Lights, music, device control',
    descriptionZh: '灯光、音乐、设备控制',
    icon: '🏠',
    skills: [
      'openhue',
      'sonoscli',
      'spotify-player',
    ],
  },
  {
    id: 'media',
    name: 'Media & Creative',
    nameZh: '多媒体创作',
    description: 'Image generation, video processing, audio transcription',
    descriptionZh: '图片生成、视频处理、音频转写',
    icon: '🎨',
    skills: [
      'openai-image-gen',
      'nano-banana-pro',
      'video-frames',
      'openai-whisper-api',
    ],
  },
  {
    id: 'communication',
    name: 'Communication',
    nameZh: '通讯增强',
    description: 'Messaging, voice calls, notifications',
    descriptionZh: '消息管理、语音通话、通知',
    icon: '💬',
    skills: [
      'discord',
      'slack',
      'voice-call',
      'imsg',
    ],
  },
  {
    id: 'security',
    name: 'Security & Privacy',
    nameZh: '安全隐私',
    description: 'Password management, secrets',
    descriptionZh: '密码管理、密钥存储',
    icon: '🔐',
    skills: [
      '1password',
    ],
  },
  {
    id: 'information',
    name: 'Information',
    nameZh: '信息获取',
    description: 'Weather, news, web browsing',
    descriptionZh: '天气、新闻、网页浏览',
    icon: '🌐',
    skills: [
      'weather',
      'blogwatcher',
      'summarize',
    ],
  },
];
```

### 2.5 默认预装机制设计

ClawX 需要在代码层面实现**默认技能**和**默认扩展**的预装机制，确保用户开箱即用。

#### 2.5.1 预装配置定义

```typescript
// electron/presets/defaults.ts

/**
 * ClawX 预装配置
 * 定义首次安装时默认启用的技能和扩展
 */
export interface ClawXPresets {
  /** 默认启用的技能 ID 列表 */
  skills: string[];
  
  /** 默认启用的扩展 ID 列表 */
  extensions: string[];
  
  /** 默认技能包 (用户可在安装向导中选择) */
  defaultBundles: string[];
  
  /** 核心技能 (始终启用，用户不可禁用) */
  coreSkills: string[];
  
  /** 核心扩展 (始终启用，用户不可禁用) */
  coreExtensions: string[];
}

/**
 * ClawX 默认预装配置
 */
export const CLAWX_PRESETS: ClawXPresets = {
  // 默认启用的技能 (首次安装自动启用)
  skills: [
    // Tier 1: 核心体验技能
    'coding-agent',      // 代码助手 (类似 opencode)
    'canvas',            // Canvas UI
    'summarize',         // 内容摘要
    
    // Tier 2: 常用工具技能
    'weather',           // 天气查询
    'github',            // GitHub 集成
    'clawhub',           // 技能市场
  ],
  
  // 默认启用的扩展
  extensions: [
    'lobster',           // UI 美化
    'memory-core',       // 记忆系统
  ],
  
  // 默认推荐的技能包 (安装向导中预选)
  defaultBundles: [
    'productivity',
    'developer',
  ],
  
  // 核心技能 (不可禁用)
  coreSkills: [
    'coding-agent',      // 代码能力是核心体验
  ],
  
  // 核心扩展 (不可禁用)
  coreExtensions: [
    'memory-core',       // 记忆是核心功能
  ],
};
```

#### 2.5.2 预装加载器

```typescript
// electron/installer/preset-loader.ts

import { CLAWX_PRESETS } from '../presets/defaults';
import { GatewayManager } from '../gateway/manager';

export interface PresetLoadResult {
  skills: { id: string; status: 'loaded' | 'failed'; error?: string }[];
  extensions: { id: string; status: 'loaded' | 'failed'; error?: string }[];
}

export class PresetLoader {
  constructor(private gateway: GatewayManager) {}
  
  /**
   * 首次安装时加载所有预装项
   */
  async loadInitialPresets(): Promise<PresetLoadResult> {
    const result: PresetLoadResult = { skills: [], extensions: [] };
    
    // 1. 加载核心扩展 (优先级最高)
    for (const extId of CLAWX_PRESETS.coreExtensions) {
      const status = await this.loadExtension(extId, { required: true });
      result.extensions.push({ id: extId, ...status });
    }
    
    // 2. 加载默认扩展
    for (const extId of CLAWX_PRESETS.extensions) {
      if (!CLAWX_PRESETS.coreExtensions.includes(extId)) {
        const status = await this.loadExtension(extId, { required: false });
        result.extensions.push({ id: extId, ...status });
      }
    }
    
    // 3. 加载核心技能
    for (const skillId of CLAWX_PRESETS.coreSkills) {
      const status = await this.loadSkill(skillId, { required: true });
      result.skills.push({ id: skillId, ...status });
    }
    
    // 4. 加载默认技能
    for (const skillId of CLAWX_PRESETS.skills) {
      if (!CLAWX_PRESETS.coreSkills.includes(skillId)) {
        const status = await this.loadSkill(skillId, { required: false });
        result.skills.push({ id: skillId, ...status });
      }
    }
    
    return result;
  }
  
  /**
   * 加载用户选择的技能包
   */
  async loadBundles(bundleIds: string[]): Promise<void> {
    const { skillBundles } = await import('../../resources/skills/bundles');
    
    for (const bundleId of bundleIds) {
      const bundle = skillBundles.find(b => b.id === bundleId);
      if (bundle) {
        for (const skillId of bundle.skills) {
          await this.loadSkill(skillId, { required: false });
        }
      }
    }
  }
  
  private async loadSkill(
    skillId: string, 
    opts: { required: boolean }
  ): Promise<{ status: 'loaded' | 'failed'; error?: string }> {
    try {
      // 通过 Gateway RPC 启用技能
      await this.gateway.rpc('skills.enable', { skillId });
      return { status: 'loaded' };
    } catch (error) {
      if (opts.required) {
        throw new Error(`Failed to load required skill: ${skillId}`);
      }
      return { status: 'failed', error: String(error) };
    }
  }
  
  private async loadExtension(
    extId: string,
    opts: { required: boolean }
  ): Promise<{ status: 'loaded' | 'failed'; error?: string }> {
    try {
      // 通过 Gateway RPC 启用扩展
      await this.gateway.rpc('plugins.enable', { pluginId: extId });
      return { status: 'loaded' };
    } catch (error) {
      if (opts.required) {
        throw new Error(`Failed to load required extension: ${extId}`);
      }
      return { status: 'failed', error: String(error) };
    }
  }
}
```

#### 2.5.3 预装状态管理

```typescript
// src/stores/presets.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PresetState {
  /** 是否已完成首次预装 */
  initialized: boolean;
  
  /** 用户选择的技能包 */
  selectedBundles: string[];
  
  /** 用户额外启用的技能 */
  enabledSkills: string[];
  
  /** 用户禁用的默认技能 (不包括核心技能) */
  disabledSkills: string[];
  
  /** 用户额外启用的扩展 */
  enabledExtensions: string[];
  
  /** 用户禁用的默认扩展 (不包括核心扩展) */
  disabledExtensions: string[];
  
  // Actions
  setInitialized: (value: boolean) => void;
  setSelectedBundles: (bundles: string[]) => void;
  toggleSkill: (skillId: string, enabled: boolean) => void;
  toggleExtension: (extId: string, enabled: boolean) => void;
  
  // Computed
  getEffectiveSkills: () => string[];
  getEffectiveExtensions: () => string[];
}

export const usePresetStore = create<PresetState>()(
  persist(
    (set, get) => ({
      initialized: false,
      selectedBundles: [],
      enabledSkills: [],
      disabledSkills: [],
      enabledExtensions: [],
      disabledExtensions: [],
      
      setInitialized: (value) => set({ initialized: value }),
      
      setSelectedBundles: (bundles) => set({ selectedBundles: bundles }),
      
      toggleSkill: (skillId, enabled) => {
        const { enabledSkills, disabledSkills } = get();
        if (enabled) {
          set({
            enabledSkills: [...enabledSkills, skillId],
            disabledSkills: disabledSkills.filter(id => id !== skillId),
          });
        } else {
          set({
            enabledSkills: enabledSkills.filter(id => id !== skillId),
            disabledSkills: [...disabledSkills, skillId],
          });
        }
      },
      
      toggleExtension: (extId, enabled) => {
        const { enabledExtensions, disabledExtensions } = get();
        if (enabled) {
          set({
            enabledExtensions: [...enabledExtensions, extId],
            disabledExtensions: disabledExtensions.filter(id => id !== extId),
          });
        } else {
          set({
            enabledExtensions: enabledExtensions.filter(id => id !== extId),
            disabledExtensions: [...disabledExtensions, extId],
          });
        }
      },
      
      // 计算实际生效的技能列表
      getEffectiveSkills: () => {
        const { selectedBundles, enabledSkills, disabledSkills } = get();
        const { CLAWX_PRESETS } = require('../../electron/presets/defaults');
        const { skillBundles } = require('../../resources/skills/bundles');
        
        // 1. 核心技能 (始终包含)
        const skills = new Set(CLAWX_PRESETS.coreSkills);
        
        // 2. 默认技能
        CLAWX_PRESETS.skills.forEach((id: string) => skills.add(id));
        
        // 3. 选中的技能包
        for (const bundleId of selectedBundles) {
          const bundle = skillBundles.find((b: any) => b.id === bundleId);
          bundle?.skills.forEach((id: string) => skills.add(id));
        }
        
        // 4. 用户额外启用的
        enabledSkills.forEach(id => skills.add(id));
        
        // 5. 移除用户禁用的 (但不能移除核心技能)
        disabledSkills.forEach(id => {
          if (!CLAWX_PRESETS.coreSkills.includes(id)) {
            skills.delete(id);
          }
        });
        
        return Array.from(skills);
      },
      
      getEffectiveExtensions: () => {
        // 类似逻辑...
        const { enabledExtensions, disabledExtensions } = get();
        const { CLAWX_PRESETS } = require('../../electron/presets/defaults');
        
        const extensions = new Set(CLAWX_PRESETS.coreExtensions);
        CLAWX_PRESETS.extensions.forEach((id: string) => extensions.add(id));
        enabledExtensions.forEach(id => extensions.add(id));
        disabledExtensions.forEach(id => {
          if (!CLAWX_PRESETS.coreExtensions.includes(id)) {
            extensions.delete(id);
          }
        });
        
        return Array.from(extensions);
      },
    }),
    {
      name: 'clawx-presets',
    }
  )
);
```

#### 2.5.4 安装向导集成

```typescript
// src/pages/Setup/SkillStep.tsx

import { usePresetStore } from '@/stores/presets';
import { skillBundles } from '@/resources/skills/bundles';
import { CLAWX_PRESETS } from '@electron/presets/defaults';

export function SkillStep({ onNext, onBack }: StepProps) {
  const { selectedBundles, setSelectedBundles } = usePresetStore();
  
  // 默认预选推荐的技能包
  const [selected, setSelected] = useState<string[]>(
    selectedBundles.length > 0 
      ? selectedBundles 
      : CLAWX_PRESETS.defaultBundles
  );
  
  const handleToggle = (bundleId: string) => {
    setSelected(prev => 
      prev.includes(bundleId)
        ? prev.filter(id => id !== bundleId)
        : [...prev, bundleId]
    );
  };
  
  const handleNext = () => {
    setSelectedBundles(selected);
    onNext({ bundles: selected });
  };
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {skillBundles.map(bundle => (
          <Card
            key={bundle.id}
            className={cn(
              'cursor-pointer transition-all',
              selected.includes(bundle.id) && 'ring-2 ring-primary'
            )}
            onClick={() => handleToggle(bundle.id)}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{bundle.icon}</span>
                <div>
                  <CardTitle className="text-lg">{bundle.nameZh}</CardTitle>
                  <CardDescription>{bundle.descriptionZh}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {bundle.skills.slice(0, 4).map(skill => (
                  <Badge key={skill} variant="secondary" className="text-xs">
                    {skill}
                  </Badge>
                ))}
                {bundle.skills.length > 4 && (
                  <Badge variant="outline" className="text-xs">
                    +{bundle.skills.length - 4}
                  </Badge>
                )}
              </div>
            </CardContent>
            {bundle.recommended && (
              <div className="absolute top-2 right-2">
                <Badge>推荐</Badge>
              </div>
            )}
          </Card>
        ))}
      </div>
      
      {/* 核心技能提示 */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          以下核心技能将始终启用：
          {CLAWX_PRESETS.coreSkills.map(id => (
            <Badge key={id} variant="outline" className="ml-1">{id}</Badge>
          ))}
        </AlertDescription>
      </Alert>
      
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>上一步</Button>
        <Button onClick={handleNext}>下一步</Button>
      </div>
    </div>
  );
}
```

#### 2.5.5 预装层级与优先级

```
┌─────────────────────────────────────────────────────────────────┐
│                     ClawX 预装层级架构                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 0: 核心层 (Core) - 不可禁用                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Skills: coding-agent                                   │   │
│  │  Extensions: memory-core                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ▲                                      │
│                          │ 始终启用                              │
│                                                                 │
│  Layer 1: 默认层 (Default) - 可禁用                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Skills: canvas, summarize, weather, github, clawhub    │   │
│  │  Extensions: lobster                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ▲                                      │
│                          │ 首次安装自动启用                       │
│                                                                 │
│  Layer 2: 技能包层 (Bundle) - 用户选择                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  productivity: apple-reminders, notion, obsidian...     │   │
│  │  developer: github, coding-agent, tmux...               │   │
│  │  smart-home: openhue, sonoscli, spotify-player...       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ▲                                      │
│                          │ 安装向导中选择                        │
│                                                                 │
│  Layer 3: 用户层 (User) - 完全自定义                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  用户手动启用/禁用的技能和扩展                            │   │
│  │  (通过设置页面或技能市场)                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

优先级: Layer 3 > Layer 2 > Layer 1 > Layer 0 (不可覆盖)
```

#### 2.5.6 配置文件结构

```json5
// ~/.clawx/presets.json (用户本地配置)
{
  "version": 1,
  "initialized": true,
  "initializedAt": "2026-02-05T12:00:00Z",
  
  // 用户选择的技能包
  "bundles": ["productivity", "developer"],
  
  // 用户自定义覆盖
  "overrides": {
    "skills": {
      "enabled": ["custom-skill-1"],     // 额外启用
      "disabled": ["weather"]            // 禁用默认
    },
    "extensions": {
      "enabled": ["custom-ext-1"],
      "disabled": []
    }
  },
  
  // 同步到 OpenClaw 的配置 (生成后写入 ~/.openclaw/config.json)
  "syncedConfig": {
    "skills": {
      "enabled": ["coding-agent", "canvas", "github", "notion", "custom-skill-1"]
    },
    "plugins": {
      "entries": {
        "memory-core": { "enabled": true },
        "lobster": { "enabled": true }
      }
    }
  }
}
```

### 2.6 跨平台自动更新系统

ClawX 需要实现**主动式**自动更新机制，在新版本发布后主动通知用户，同时支持用户手动检查更新。

#### 2.6.1 更新策略设计

```
┌─────────────────────────────────────────────────────────────────┐
│                    ClawX 自动更新流程                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   启动检查    │    │   定时检查    │    │   手动检查    │      │
│  │  (App Start) │    │  (每6小时)    │    │ (用户触发)   │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │              │
│         └───────────────────┼───────────────────┘              │
│                             ▼                                   │
│                  ┌─────────────────────┐                       │
│                  │   Version Checker   │                       │
│                  │   检查 GitHub/CDN   │                       │
│                  └──────────┬──────────┘                       │
│                             │                                   │
│              ┌──────────────┴──────────────┐                   │
│              ▼                             ▼                   │
│     ┌────────────────┐           ┌────────────────┐           │
│     │   无新版本      │           │   有新版本      │           │
│     │   静默结束      │           │                │           │
│     └────────────────┘           └───────┬────────┘           │
│                                          │                     │
│                              ┌───────────┴───────────┐        │
│                              ▼                       ▼        │
│                    ┌──────────────┐       ┌──────────────┐    │
│                    │  主动通知弹窗  │       │  静默下载     │    │
│                    │  (询问用户)   │       │  (后台进行)   │    │
│                    └──────┬───────┘       └──────┬───────┘    │
│                           │                      │            │
│              ┌────────────┴────────────┐         │            │
│              ▼                         ▼         │            │
│     ┌────────────────┐      ┌────────────────┐   │            │
│     │   立即更新      │      │   稍后提醒      │   │            │
│     │   (下载安装)    │      │   (记录时间)    │   │            │
│     └───────┬────────┘      └────────────────┘   │            │
│             │                                    │            │
│             └────────────────────────────────────┘            │
│                             │                                  │
│                             ▼                                  │
│                  ┌─────────────────────┐                      │
│                  │   下载完成通知       │                      │
│                  │   "重启以完成更新"   │                      │
│                  └─────────────────────┘                      │
│                                                                │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.6.2 更新管理器实现

```typescript
// electron/updater/index.ts

import { autoUpdater, UpdateInfo } from 'electron-updater';
import { app, BrowserWindow, dialog, Notification } from 'electron';
import { EventEmitter } from 'events';
import log from 'electron-log';

export interface UpdateConfig {
  /** 更新通道: stable | beta | dev */
  channel: 'stable' | 'beta' | 'dev';
  
  /** 是否自动下载 */
  autoDownload: boolean;
  
  /** 是否允许降级 */
  allowDowngrade: boolean;
  
  /** 检查间隔 (毫秒) */
  checkInterval: number;
  
  /** 是否显示主动通知 */
  showNotification: boolean;
}

export interface UpdateStatus {
  state: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';
  currentVersion: string;
  latestVersion?: string;
  releaseNotes?: string;
  downloadProgress?: number;
  error?: string;
}

const DEFAULT_CONFIG: UpdateConfig = {
  channel: 'stable',
  autoDownload: false,  // 默认不自动下载，先询问用户
  allowDowngrade: false,
  checkInterval: 6 * 60 * 60 * 1000, // 6小时
  showNotification: true,
};

export class UpdateManager extends EventEmitter {
  private config: UpdateConfig;
  private status: UpdateStatus;
  private checkTimer: NodeJS.Timeout | null = null;
  private mainWindow: BrowserWindow | null = null;
  
  constructor(config: Partial<UpdateConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.status = {
      state: 'idle',
      currentVersion: app.getVersion(),
    };
    
    this.setupAutoUpdater();
  }
  
  private setupAutoUpdater(): void {
    // 配置 electron-updater
    autoUpdater.logger = log;
    autoUpdater.autoDownload = this.config.autoDownload;
    autoUpdater.allowDowngrade = this.config.allowDowngrade;
    
    // 设置更新通道
    autoUpdater.channel = this.config.channel;
    
    // GitHub Releases 作为更新源
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'clawx',
      repo: 'clawx',
    });
    
    // 事件监听
    autoUpdater.on('checking-for-update', () => {
      this.setStatus({ state: 'checking' });
    });
    
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.setStatus({
        state: 'available',
        latestVersion: info.version,
        releaseNotes: this.formatReleaseNotes(info.releaseNotes),
      });
      
      // 主动通知用户
      if (this.config.showNotification) {
        this.showUpdateNotification(info);
      }
    });
    
    autoUpdater.on('update-not-available', () => {
      this.setStatus({ state: 'idle' });
    });
    
    autoUpdater.on('download-progress', (progress) => {
      this.setStatus({
        state: 'downloading',
        downloadProgress: Math.round(progress.percent),
      });
    });
    
    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.setStatus({ state: 'downloaded' });
      this.showDownloadedNotification(info);
    });
    
    autoUpdater.on('error', (error) => {
      this.setStatus({ state: 'error', error: error.message });
    });
  }
  
  /**
   * 初始化更新器 (应用启动时调用)
   */
  initialize(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;
    
    // 启动时检查更新 (延迟5秒，避免影响启动速度)
    setTimeout(() => this.checkForUpdates(true), 5000);
    
    // 定时检查
    this.startPeriodicCheck();
  }
  
  /**
   * 启动定时检查
   */
  private startPeriodicCheck(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }
    
    this.checkTimer = setInterval(() => {
      this.checkForUpdates(true);
    }, this.config.checkInterval);
  }
  
  /**
   * 检查更新
   * @param silent 是否静默 (不显示"已是最新版本"提示)
   */
  async checkForUpdates(silent: boolean = false): Promise<void> {
    try {
      const result = await autoUpdater.checkForUpdates();
      
      if (!result?.updateInfo && !silent) {
        // 手动检查且无更新时，显示提示
        this.showNoUpdateDialog();
      }
    } catch (error) {
      if (!silent) {
        this.showErrorDialog(error as Error);
      }
    }
  }
  
  /**
   * 下载更新
   */
  async downloadUpdate(): Promise<void> {
    if (this.status.state !== 'available') return;
    await autoUpdater.downloadUpdate();
  }
  
  /**
   * 安装更新并重启
   */
  quitAndInstall(): void {
    autoUpdater.quitAndInstall(false, true);
  }
  
  /**
   * 显示更新可用通知
   */
  private showUpdateNotification(info: UpdateInfo): void {
    // 系统通知
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: 'ClawX 有新版本可用',
        body: `版本 ${info.version} 已发布，点击查看详情`,
        icon: app.isPackaged 
          ? undefined 
          : 'resources/icons/icon.png',
      });
      
      notification.on('click', () => {
        this.showUpdateDialog(info);
      });
      
      notification.show();
    }
    
    // 同时发送到渲染进程
    this.mainWindow?.webContents.send('update:available', {
      version: info.version,
      releaseNotes: this.formatReleaseNotes(info.releaseNotes),
    });
  }
  
  /**
   * 显示更新对话框 (主动询问用户)
   */
  private async showUpdateDialog(info: UpdateInfo): Promise<void> {
    const releaseNotes = this.formatReleaseNotes(info.releaseNotes);
    
    const result = await dialog.showMessageBox(this.mainWindow!, {
      type: 'info',
      title: '发现新版本',
      message: `ClawX ${info.version} 已发布`,
      detail: `当前版本: ${this.status.currentVersion}\n\n更新内容:\n${releaseNotes}`,
      buttons: ['立即更新', '稍后提醒', '跳过此版本'],
      defaultId: 0,
      cancelId: 1,
    });
    
    switch (result.response) {
      case 0: // 立即更新
        this.downloadUpdate();
        break;
      case 1: // 稍后提醒
        // 30分钟后再次提醒
        setTimeout(() => this.showUpdateNotification(info), 30 * 60 * 1000);
        break;
      case 2: // 跳过此版本
        this.skipVersion(info.version);
        break;
    }
  }
  
  /**
   * 显示下载完成通知
   */
  private showDownloadedNotification(info: UpdateInfo): void {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: '更新已就绪',
        body: `ClawX ${info.version} 已下载完成，点击重启应用以完成更新`,
      });
      
      notification.on('click', () => {
        this.showRestartDialog();
      });
      
      notification.show();
    }
    
    this.mainWindow?.webContents.send('update:downloaded', {
      version: info.version,
    });
  }
  
  /**
   * 显示重启对话框
   */
  private async showRestartDialog(): Promise<void> {
    const result = await dialog.showMessageBox(this.mainWindow!, {
      type: 'info',
      title: '更新已就绪',
      message: '重启应用以完成更新',
      detail: '更新已下载完成，是否立即重启应用？',
      buttons: ['立即重启', '稍后'],
      defaultId: 0,
    });
    
    if (result.response === 0) {
      this.quitAndInstall();
    }
  }
  
  /**
   * 显示无更新对话框 (手动检查时)
   */
  private showNoUpdateDialog(): void {
    dialog.showMessageBox(this.mainWindow!, {
      type: 'info',
      title: '检查更新',
      message: '已是最新版本',
      detail: `当前版本 ${this.status.currentVersion} 已是最新`,
      buttons: ['确定'],
    });
  }
  
  private showErrorDialog(error: Error): void {
    dialog.showMessageBox(this.mainWindow!, {
      type: 'error',
      title: '更新检查失败',
      message: '无法检查更新',
      detail: error.message,
      buttons: ['确定'],
    });
  }
  
  private formatReleaseNotes(notes: string | any): string {
    if (typeof notes === 'string') return notes;
    if (Array.isArray(notes)) {
      return notes.map(n => n.note || n).join('\n');
    }
    return '';
  }
  
  private skipVersion(version: string): void {
    // 存储跳过的版本
    const store = require('electron-store');
    const settings = new store();
    const skipped = settings.get('update.skippedVersions', []) as string[];
    if (!skipped.includes(version)) {
      settings.set('update.skippedVersions', [...skipped, version]);
    }
  }
  
  private setStatus(update: Partial<UpdateStatus>): void {
    this.status = { ...this.status, ...update };
    this.emit('status', this.status);
    this.mainWindow?.webContents.send('update:status', this.status);
  }
  
  getStatus(): UpdateStatus {
    return this.status;
  }
  
  setConfig(config: Partial<UpdateConfig>): void {
    this.config = { ...this.config, ...config };
    autoUpdater.channel = this.config.channel;
    autoUpdater.autoDownload = this.config.autoDownload;
    
    // 重启定时检查
    this.startPeriodicCheck();
  }
}

// 导出单例
export const updateManager = new UpdateManager();
```

#### 2.6.3 渲染进程更新 UI

```typescript
// src/hooks/useUpdate.ts

import { useState, useEffect } from 'react';

interface UpdateStatus {
  state: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';
  currentVersion: string;
  latestVersion?: string;
  releaseNotes?: string;
  downloadProgress?: number;
  error?: string;
}

export function useUpdate() {
  const [status, setStatus] = useState<UpdateStatus>({
    state: 'idle',
    currentVersion: '0.0.0',
  });
  
  useEffect(() => {
    // 监听主进程更新状态
    const handleStatus = (_: any, newStatus: UpdateStatus) => {
      setStatus(newStatus);
    };
    
    window.electron.ipcRenderer.on('update:status', handleStatus);
    
    // 获取初始状态
    window.electron.ipcRenderer.invoke('update:getStatus').then(setStatus);
    
    return () => {
      window.electron.ipcRenderer.off('update:status', handleStatus);
    };
  }, []);
  
  const checkForUpdates = () => {
    window.electron.ipcRenderer.invoke('update:check');
  };
  
  const downloadUpdate = () => {
    window.electron.ipcRenderer.invoke('update:download');
  };
  
  const installUpdate = () => {
    window.electron.ipcRenderer.invoke('update:install');
  };
  
  return {
    status,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  };
}
```

```typescript
// src/components/UpdateNotification.tsx

import { useUpdate } from '@/hooks/useUpdate';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, RefreshCw, X, Loader2 } from 'lucide-react';

export function UpdateNotification() {
  const { status, downloadUpdate, installUpdate } = useUpdate();
  const [dismissed, setDismissed] = useState(false);
  
  // 只在有更新可用或已下载时显示
  const shouldShow = 
    !dismissed && 
    (status.state === 'available' || status.state === 'downloaded');
  
  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-4 right-4 z-50 max-w-sm"
        >
          <Card className="border-primary/50 shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {status.state === 'available' ? (
                    <>
                      <Download className="w-4 h-4 text-primary" />
                      新版本可用
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 text-green-500" />
                      更新已就绪
                    </>
                  )}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setDismissed(true)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground mb-3">
                ClawX {status.latestVersion} 已发布
              </p>
              
              {status.state === 'downloading' && (
                <div className="mb-3">
                  <Progress value={status.downloadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    下载中 {status.downloadProgress}%
                  </p>
                </div>
              )}
              
              <div className="flex gap-2">
                {status.state === 'available' && (
                  <Button size="sm" onClick={downloadUpdate}>
                    立即下载
                  </Button>
                )}
                {status.state === 'downloaded' && (
                  <Button size="sm" onClick={installUpdate}>
                    重启更新
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDismissed(true)}
                >
                  稍后
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

#### 2.6.4 设置页面手动检查入口

```typescript
// src/pages/Settings/GeneralSettings.tsx

import { useUpdate } from '@/hooks/useUpdate';

export function GeneralSettings() {
  const { status, checkForUpdates } = useUpdate();
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>通用设置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 版本与更新 */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">版本与更新</Label>
          
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <p className="font-medium">ClawX</p>
              <p className="text-sm text-muted-foreground">
                当前版本: {status.currentVersion}
              </p>
              {status.latestVersion && status.state === 'available' && (
                <p className="text-sm text-primary">
                  新版本可用: {status.latestVersion}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              onClick={checkForUpdates}
              disabled={status.state === 'checking'}
            >
              {status.state === 'checking' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  检查中...
                </>
              ) : (
                '检查更新'
              )}
            </Button>
          </div>
          
          {/* 更新设置 */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">自动检查更新</p>
                <p className="text-xs text-muted-foreground">
                  启动时和每6小时自动检查
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">自动下载更新</p>
                <p className="text-xs text-muted-foreground">
                  发现新版本后在后台自动下载
                </p>
              </div>
              <Switch />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">更新通道</p>
                <p className="text-xs text-muted-foreground">
                  选择接收更新的类型
                </p>
              </div>
              <Select defaultValue="stable">
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stable">稳定版</SelectItem>
                  <SelectItem value="beta">测试版</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        
        <Separator />
        
        {/* 其他设置... */}
      </CardContent>
    </Card>
  );
}
```

#### 2.6.5 跨平台配置

```typescript
// electron/updater/channels.ts

import { Platform } from 'electron-builder';

export interface PlatformUpdateConfig {
  /** 更新源 URL */
  feedUrl: string;
  
  /** 是否支持差量更新 */
  supportsDelta: boolean;
  
  /** 安装方式 */
  installMethod: 'nsis' | 'dmg' | 'appimage' | 'deb' | 'rpm';
}

export const PLATFORM_CONFIGS: Record<NodeJS.Platform, PlatformUpdateConfig> = {
  darwin: {
    feedUrl: 'https://releases.clawx.app/mac',
    supportsDelta: true,  // macOS 支持 Sparkle 差量更新
    installMethod: 'dmg',
  },
  win32: {
    feedUrl: 'https://releases.clawx.app/win',
    supportsDelta: true,  // Windows NSIS 支持差量
    installMethod: 'nsis',
  },
  linux: {
    feedUrl: 'https://releases.clawx.app/linux',
    supportsDelta: false, // AppImage 不支持差量
    installMethod: 'appimage',
  },
} as Record<NodeJS.Platform, PlatformUpdateConfig>;

// electron-builder.yml 配置示例
export const ELECTRON_BUILDER_CONFIG = `
appId: app.clawx.desktop
productName: ClawX
copyright: Copyright © 2026 ClawX

publish:
  - provider: github
    owner: clawx
    repo: clawx
    releaseType: release

mac:
  category: public.app-category.productivity
  target:
    - target: dmg
      arch: [universal]
    - target: zip
      arch: [universal]
  notarize:
    teamId: \${env.APPLE_TEAM_ID}

win:
  target:
    - target: nsis
      arch: [x64, arm64]
  publisherName: ClawX Inc.
  
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  differentialPackage: true  # 启用差量更新

linux:
  target:
    - target: AppImage
      arch: [x64, arm64]
    - target: deb
      arch: [x64]
  category: Utility
`;
```

#### 2.6.6 更新时间线与用户交互

```
用户视角的更新流程:

┌─────────────────────────────────────────────────────────────────┐
│ 场景 A: 有新版本时主动通知                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 用户正在使用 ClawX                                          │
│     │                                                           │
│  2. 系统检测到新版本 (启动时/定时检查)                            │
│     │                                                           │
│  3. 右上角弹出通知卡片 ────────────────────┐                    │
│     │                                    │                     │
│     │  ┌─────────────────────────────┐   │                     │
│     │  │ 🔔 新版本可用                │   │                     │
│     │  │ ClawX 1.2.0 已发布          │   │                     │
│     │  │ [立即下载] [稍后]            │   │                     │
│     │  └─────────────────────────────┘   │                     │
│     │                                    │                     │
│  4. 用户点击"立即下载"                                           │
│     │                                                           │
│  5. 后台下载，通知卡片显示进度                                    │
│     │                                                           │
│  6. 下载完成，通知"重启以完成更新"                                │
│     │                                                           │
│  7. 用户选择"立即重启"或继续工作后重启                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 场景 B: 用户手动检查更新                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 用户打开 设置 → 通用 → 检查更新                               │
│     │                                                           │
│  2. 显示"检查中..."                                              │
│     │                                                           │
│  3a. 无更新 → 弹窗提示"已是最新版本 (1.1.0)"                      │
│     │                                                           │
│  3b. 有更新 → 弹窗显示更新详情                                    │
│     │                                                           │
│     │  ┌─────────────────────────────────────┐                 │
│     │  │ 发现新版本                           │                 │
│     │  │                                     │                 │
│     │  │ ClawX 1.2.0 已发布                  │                 │
│     │  │ 当前版本: 1.1.0                     │                 │
│     │  │                                     │                 │
│     │  │ 更新内容:                           │                 │
│     │  │ • 新增技能市场                      │                 │
│     │  │ • 修复 Windows 启动问题             │                 │
│     │  │ • 性能优化                          │                 │
│     │  │                                     │                 │
│     │  │ [立即更新] [稍后提醒] [跳过此版本]   │                 │
│     │  └─────────────────────────────────────┘                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.7 GUI 权限提升机制

ClawX 需要在某些操作时获取管理员权限（如全局安装 Node.js、修改系统 PATH），必须通过**图形化密码弹窗**而非命令行 `sudo`。

#### 2.7.1 需要管理员权限的场景

| 场景 | 操作 | 原因 |
|------|------|------|
| Node.js 安装 | 写入 `/usr/local/bin` (macOS/Linux) | 系统目录需要 root |
| 全局 npm 安装 | `npm install -g openclaw` | 系统 node_modules |
| PATH 配置 | 修改 `/etc/paths.d/` | 系统级环境变量 |
| 端口 < 1024 | Gateway 使用低端口 | 特权端口 |
| 系统服务注册 | LaunchDaemon / systemd | 开机自启 |

#### 2.7.2 跨平台权限提升架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    ClawX 权限提升流程                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐                                          │
│  │  需要管理员权限    │                                          │
│  │  的操作触发       │                                          │
│  └────────┬─────────┘                                          │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────┐                                          │
│  │  PrivilegeManager │                                          │
│  │  检测当前平台      │                                          │
│  └────────┬─────────┘                                          │
│           │                                                     │
│     ┌─────┴─────┬─────────────┐                                │
│     ▼           ▼             ▼                                │
│  ┌──────┐   ┌──────┐    ┌──────┐                              │
│  │macOS │   │Windows│    │Linux │                              │
│  └──┬───┘   └──┬───┘    └──┬───┘                              │
│     │          │           │                                    │
│     ▼          ▼           ▼                                    │
│  ┌────────┐ ┌────────┐ ┌────────┐                             │
│  │osascript│ │  UAC   │ │pkexec │                             │
│  │密码弹窗 │ │提升弹窗│ │密码弹窗│                             │
│  └────────┘ └────────┘ └────────┘                             │
│     │          │           │                                    │
│     └──────────┴───────────┘                                   │
│                │                                                │
│                ▼                                                │
│  ┌──────────────────────────┐                                  │
│  │  以管理员身份执行命令      │                                  │
│  │  (无需终端 sudo 输入)     │                                  │
│  └──────────────────────────┘                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.7.3 权限管理器实现

```typescript
// electron/privilege/index.ts

import { dialog } from 'electron';
import { platform } from 'os';
import { DarwinAdmin } from './darwin-admin';
import { Win32Admin } from './win32-admin';
import { LinuxAdmin } from './linux-admin';

export interface PrivilegeResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
}

export interface PrivilegeOptions {
  /** 向用户展示的操作说明 */
  reason: string;
  
  /** 图标路径 */
  icon?: string;
  
  /** 超时时间 (毫秒) */
  timeout?: number;
}

/**
 * 跨平台权限提升管理器
 * 通过 GUI 弹窗获取管理员权限，而非命令行 sudo
 */
export class PrivilegeManager {
  private admin: DarwinAdmin | Win32Admin | LinuxAdmin;
  
  constructor() {
    switch (platform()) {
      case 'darwin':
        this.admin = new DarwinAdmin();
        break;
      case 'win32':
        this.admin = new Win32Admin();
        break;
      case 'linux':
        this.admin = new LinuxAdmin();
        break;
      default:
        throw new Error(`Unsupported platform: ${platform()}`);
    }
  }
  
  /**
   * 检查是否已有管理员权限
   */
  async hasAdminPrivilege(): Promise<boolean> {
    return this.admin.hasAdminPrivilege();
  }
  
  /**
   * 以管理员权限执行命令 (会弹出密码框)
   */
  async execAsAdmin(
    command: string,
    options: PrivilegeOptions
  ): Promise<PrivilegeResult> {
    // 先检查是否真的需要提权
    if (await this.hasAdminPrivilege()) {
      // 已经是 admin，直接执行
      return this.admin.exec(command);
    }
    
    // 显示确认对话框
    const confirmed = await this.showConfirmDialog(options.reason);
    if (!confirmed) {
      return { success: false, error: 'User cancelled' };
    }
    
    // 通过平台特定方式获取权限并执行
    return this.admin.execWithPrivilege(command, options);
  }
  
  /**
   * 显示权限请求确认对话框
   */
  private async showConfirmDialog(reason: string): Promise<boolean> {
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: '需要管理员权限',
      message: 'ClawX 需要管理员权限来完成此操作',
      detail: `${reason}\n\n点击"继续"后将弹出系统密码输入框。`,
      buttons: ['继续', '取消'],
      defaultId: 0,
      cancelId: 1,
    });
    
    return result.response === 0;
  }
}

export const privilegeManager = new PrivilegeManager();
```

#### 2.7.4 macOS 实现 (osascript)

```typescript
// electron/privilege/darwin-admin.ts

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class DarwinAdmin {
  /**
   * 检查是否以 root 运行
   */
  async hasAdminPrivilege(): Promise<boolean> {
    try {
      await execAsync('test -w /usr/local/bin');
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * 直接执行命令
   */
  async exec(command: string): Promise<PrivilegeResult> {
    try {
      const { stdout, stderr } = await execAsync(command);
      return { success: true, stdout, stderr };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 通过 osascript 弹出系统密码框执行命令
   * 这会显示 macOS 原生的授权对话框
   */
  async execWithPrivilege(
    command: string,
    options: PrivilegeOptions
  ): Promise<PrivilegeResult> {
    // 使用 osascript 调用 Authorization Services
    // 这会弹出 macOS 原生密码输入框
    const escapedCommand = command.replace(/"/g, '\\"');
    const escapedReason = options.reason.replace(/"/g, '\\"');
    
    const appleScript = `
      do shell script "${escapedCommand}" \\
        with administrator privileges \\
        with prompt "${escapedReason}"
    `;
    
    try {
      const { stdout, stderr } = await execAsync(
        `osascript -e '${appleScript.replace(/'/g, "'\"'\"'")}'`,
        { timeout: options.timeout || 60000 }
      );
      return { success: true, stdout, stderr };
    } catch (error: any) {
      // 用户取消会抛出错误
      if (error.message.includes('User canceled')) {
        return { success: false, error: 'User cancelled' };
      }
      return { success: false, error: error.message };
    }
  }
}
```

#### 2.7.5 Windows 实现 (UAC)

```typescript
// electron/privilege/win32-admin.ts

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

export class Win32Admin {
  /**
   * 检查是否以管理员运行
   */
  async hasAdminPrivilege(): Promise<boolean> {
    try {
      // 尝试写入 System32，如果成功说明有管理员权限
      await execAsync('fsutil dirty query %systemdrive%');
      return true;
    } catch {
      return false;
    }
  }
  
  async exec(command: string): Promise<PrivilegeResult> {
    try {
      const { stdout, stderr } = await execAsync(command, { shell: 'powershell.exe' });
      return { success: true, stdout, stderr };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 通过 UAC 提升权限执行命令
   * 这会弹出 Windows UAC 确认对话框
   */
  async execWithPrivilege(
    command: string,
    options: PrivilegeOptions
  ): Promise<PrivilegeResult> {
    return new Promise((resolve) => {
      // 创建临时 PowerShell 脚本
      const scriptPath = join(tmpdir(), `clawx-admin-${Date.now()}.ps1`);
      const outputPath = join(tmpdir(), `clawx-admin-${Date.now()}.txt`);
      
      // PowerShell 脚本内容
      const script = `
        try {
          ${command}
          "SUCCESS" | Out-File -FilePath "${outputPath}"
        } catch {
          $_.Exception.Message | Out-File -FilePath "${outputPath}"
          exit 1
        }
      `;
      
      writeFileSync(scriptPath, script, 'utf-8');
      
      // 使用 PowerShell 的 Start-Process 触发 UAC
      const elevateCommand = `
        Start-Process powershell.exe \
          -ArgumentList '-ExecutionPolicy Bypass -File "${scriptPath}"' \
          -Verb RunAs \
          -Wait
      `;
      
      const child = spawn('powershell.exe', ['-Command', elevateCommand], {
        stdio: 'pipe',
      });
      
      child.on('close', (code) => {
        try {
          const output = require('fs').readFileSync(outputPath, 'utf-8').trim();
          unlinkSync(scriptPath);
          unlinkSync(outputPath);
          
          if (output === 'SUCCESS') {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: output });
          }
        } catch (error: any) {
          resolve({ success: false, error: 'UAC cancelled or failed' });
        }
      });
    });
  }
}
```

#### 2.7.6 Linux 实现 (pkexec/polkit)

```typescript
// electron/privilege/linux-admin.ts

import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class LinuxAdmin {
  async hasAdminPrivilege(): Promise<boolean> {
    return process.getuid?.() === 0;
  }
  
  async exec(command: string): Promise<PrivilegeResult> {
    try {
      const { stdout, stderr } = await execAsync(command);
      return { success: true, stdout, stderr };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 通过 pkexec 弹出图形化密码框
   * pkexec 是 polkit 的一部分，大多数 Linux 桌面都支持
   */
  async execWithPrivilege(
    command: string,
    options: PrivilegeOptions
  ): Promise<PrivilegeResult> {
    return new Promise((resolve) => {
      // 检查 pkexec 是否可用
      exec('which pkexec', (error) => {
        if (error) {
          // 回退到 gksudo 或 kdesudo
          this.execWithFallback(command, options).then(resolve);
          return;
        }
        
        // 使用 pkexec (会弹出 polkit 密码框)
        const child = spawn('pkexec', ['bash', '-c', command], {
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            // 设置 polkit 显示的描述
            POLKIT_AGENT_HELPER_NAME: 'ClawX',
          },
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', (data) => { stdout += data; });
        child.stderr.on('data', (data) => { stderr += data; });
        
        child.on('close', (code) => {
          if (code === 0) {
            resolve({ success: true, stdout, stderr });
          } else if (code === 126) {
            // 用户取消
            resolve({ success: false, error: 'User cancelled' });
          } else {
            resolve({ success: false, error: stderr || `Exit code: ${code}` });
          }
        });
      });
    });
  }
  
  /**
   * pkexec 不可用时的回退方案
   */
  private async execWithFallback(
    command: string,
    options: PrivilegeOptions
  ): Promise<PrivilegeResult> {
    // 尝试 gksudo (GNOME) 或 kdesudo (KDE)
    const fallbacks = ['gksudo', 'kdesudo', 'sudo -A'];
    
    for (const fallback of fallbacks) {
      try {
        const { stdout, stderr } = await execAsync(`${fallback} ${command}`);
        return { success: true, stdout, stderr };
      } catch {
        continue;
      }
    }
    
    return { 
      success: false, 
      error: 'No GUI sudo helper available. Please run ClawX as root.' 
    };
  }
}
```

#### 2.7.7 使用示例

```typescript
// electron/installer/node-installer.ts

import { privilegeManager } from '../privilege';

export async function installNodeGlobally(): Promise<void> {
  const isNodeInstalled = await checkNodeInstalled();
  
  if (!isNodeInstalled) {
    // 通过 GUI 弹窗获取管理员权限安装 Node.js
    const result = await privilegeManager.execAsAdmin(
      // macOS: 使用 Homebrew
      process.platform === 'darwin'
        ? '/opt/homebrew/bin/brew install node@22'
        // Windows: 使用 winget
        : process.platform === 'win32'
        ? 'winget install OpenJS.NodeJS.LTS'
        // Linux: 使用包管理器
        : 'apt-get install -y nodejs',
      {
        reason: '安装 Node.js 运行时环境，这是 ClawX 运行的必要组件。',
      }
    );
    
    if (!result.success) {
      throw new Error(`Node.js 安装失败: ${result.error}`);
    }
  }
}
```

### 2.8 GUI 环境变量配置

ClawX 需要管理多种环境变量（API Keys、PATH、代理设置等），必须通过**图形界面**配置，而非要求用户编辑 `.env` 文件或终端。

#### 2.8.1 环境变量分类

| 类型 | 示例 | 存储位置 | 安全级别 |
|------|------|----------|----------|
| **API Keys** | `ANTHROPIC_API_KEY` | 系统密钥链 | 🔐 加密存储 |
| **PATH** | Node.js/npm 路径 | Shell Profile | 普通 |
| **代理** | `HTTP_PROXY` | 应用配置 | 普通 |
| **应用配置** | `CLAWX_PORT` | 应用配置 | 普通 |

#### 2.8.2 环境配置管理器

```typescript
// electron/env-config/index.ts

import { safeStorage, app } from 'electron';
import Store from 'electron-store';
import { PathManager } from './path-manager';
import { ApiKeyManager } from './api-keys';
import { ShellProfileManager } from './shell-profile';

export interface EnvConfig {
  // API Keys (加密存储)
  apiKeys: {
    anthropic?: string;
    openai?: string;
    google?: string;
    [key: string]: string | undefined;
  };
  
  // 代理设置
  proxy: {
    http?: string;
    https?: string;
    noProxy?: string[];
  };
  
  // 应用配置
  app: {
    port?: number;
    logLevel?: string;
    dataDir?: string;
  };
}

export class EnvConfigManager {
  private store: Store;
  private pathManager: PathManager;
  private apiKeyManager: ApiKeyManager;
  private shellProfileManager: ShellProfileManager;
  
  constructor() {
    this.store = new Store({ name: 'env-config' });
    this.pathManager = new PathManager();
    this.apiKeyManager = new ApiKeyManager();
    this.shellProfileManager = new ShellProfileManager();
  }
  
  /**
   * 获取所有环境配置 (API Keys 脱敏)
   */
  getConfig(): EnvConfig {
    return {
      apiKeys: this.apiKeyManager.getMaskedKeys(),
      proxy: this.store.get('proxy', {}) as EnvConfig['proxy'],
      app: this.store.get('app', {}) as EnvConfig['app'],
    };
  }
  
  /**
   * 设置 API Key (自动加密存储)
   */
  async setApiKey(provider: string, key: string): Promise<void> {
    await this.apiKeyManager.setKey(provider, key);
    
    // 同步到 OpenClaw 配置
    await this.syncToOpenClaw();
  }
  
  /**
   * 设置代理
   */
  setProxy(proxy: EnvConfig['proxy']): void {
    this.store.set('proxy', proxy);
    this.applyProxy(proxy);
  }
  
  /**
   * 确保 PATH 包含必要的路径
   */
  async ensurePath(): Promise<void> {
    const requiredPaths = [
      '/usr/local/bin',
      '/opt/homebrew/bin',        // macOS ARM
      `${app.getPath('home')}/.nvm/versions/node/*/bin`, // nvm
      `${app.getPath('home')}/.local/bin`, // pip install --user
    ];
    
    for (const p of requiredPaths) {
      await this.pathManager.addToPath(p);
    }
  }
  
  /**
   * 同步配置到 OpenClaw
   */
  private async syncToOpenClaw(): Promise<void> {
    const openclawConfigPath = `${app.getPath('home')}/.openclaw/config.json`;
    // 读取现有配置，合并 API keys，写回
    // ...
  }
  
  private applyProxy(proxy: EnvConfig['proxy']): void {
    if (proxy.http) process.env.HTTP_PROXY = proxy.http;
    if (proxy.https) process.env.HTTPS_PROXY = proxy.https;
    if (proxy.noProxy) process.env.NO_PROXY = proxy.noProxy.join(',');
  }
}

export const envConfigManager = new EnvConfigManager();
```

#### 2.8.3 API Key 安全存储

```typescript
// electron/env-config/api-keys.ts

import { safeStorage } from 'electron';
import Store from 'electron-store';
import keytar from 'keytar';

const SERVICE_NAME = 'ClawX';

/**
 * API Key 管理器
 * 使用系统密钥链安全存储敏感信息
 */
export class ApiKeyManager {
  private store: Store;
  
  constructor() {
    this.store = new Store({ name: 'api-keys-meta' });
  }
  
  /**
   * 安全存储 API Key
   * - macOS: 使用 Keychain
   * - Windows: 使用 Credential Manager
   * - Linux: 使用 libsecret (GNOME Keyring / KWallet)
   */
  async setKey(provider: string, key: string): Promise<void> {
    try {
      // 首选: 系统密钥链 (通过 keytar)
      await keytar.setPassword(SERVICE_NAME, provider, key);
      this.store.set(`providers.${provider}`, { stored: true, method: 'keychain' });
    } catch {
      // 回退: Electron safeStorage (本地加密)
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(key);
        this.store.set(`providers.${provider}`, { 
          stored: true, 
          method: 'safeStorage',
          encrypted: encrypted.toString('base64'),
        });
      } else {
        throw new Error('No secure storage available');
      }
    }
  }
  
  /**
   * 获取 API Key
   */
  async getKey(provider: string): Promise<string | null> {
    const meta = this.store.get(`providers.${provider}`) as any;
    if (!meta?.stored) return null;
    
    if (meta.method === 'keychain') {
      return keytar.getPassword(SERVICE_NAME, provider);
    } else if (meta.method === 'safeStorage' && meta.encrypted) {
      const buffer = Buffer.from(meta.encrypted, 'base64');
      return safeStorage.decryptString(buffer);
    }
    
    return null;
  }
  
  /**
   * 删除 API Key
   */
  async deleteKey(provider: string): Promise<void> {
    const meta = this.store.get(`providers.${provider}`) as any;
    if (!meta?.stored) return;
    
    if (meta.method === 'keychain') {
      await keytar.deletePassword(SERVICE_NAME, provider);
    }
    
    this.store.delete(`providers.${provider}`);
  }
  
  /**
   * 获取所有已配置的 Key (脱敏显示)
   */
  getMaskedKeys(): Record<string, string | undefined> {
    const result: Record<string, string | undefined> = {};
    const providers = this.store.get('providers', {}) as Record<string, any>;
    
    for (const [provider, meta] of Object.entries(providers)) {
      if (meta?.stored) {
        result[provider] = '••••••••••••'; // 脱敏显示
      }
    }
    
    return result;
  }
  
  /**
   * 检查 Key 是否已配置
   */
  hasKey(provider: string): boolean {
    const meta = this.store.get(`providers.${provider}`) as any;
    return meta?.stored === true;
  }
}
```

#### 2.8.4 PATH 环境变量管理

```typescript
// electron/env-config/path-manager.ts

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';
import { privilegeManager } from '../privilege';

const execAsync = promisify(exec);

export class PathManager {
  /**
   * 添加路径到 PATH 环境变量
   * 通过 GUI 完成，用户无需手动编辑 shell 配置文件
   */
  async addToPath(newPath: string): Promise<void> {
    // 检查路径是否已存在
    const currentPath = process.env.PATH || '';
    if (currentPath.includes(newPath)) return;
    
    // 检查路径是否有效
    if (!existsSync(newPath) && !newPath.includes('*')) return;
    
    switch (platform()) {
      case 'darwin':
        await this.addToPathMacOS(newPath);
        break;
      case 'win32':
        await this.addToPathWindows(newPath);
        break;
      case 'linux':
        await this.addToPathLinux(newPath);
        break;
    }
  }
  
  /**
   * macOS: 添加到 /etc/paths.d/ (系统级) 或 shell profile (用户级)
   */
  private async addToPathMacOS(newPath: string): Promise<void> {
    // 优先使用用户级配置 (~/.zshrc 或 ~/.bash_profile)
    const shellProfile = this.getShellProfile();
    
    if (shellProfile) {
      const content = existsSync(shellProfile) 
        ? readFileSync(shellProfile, 'utf-8')
        : '';
      
      if (!content.includes(newPath)) {
        const exportLine = `\nexport PATH="${newPath}:$PATH"\n`;
        writeFileSync(shellProfile, content + exportLine);
      }
    } else {
      // 回退到系统级 (需要管理员权限)
      const pathFile = `/etc/paths.d/clawx`;
      await privilegeManager.execAsAdmin(
        `echo "${newPath}" >> ${pathFile}`,
        { reason: '配置系统 PATH 环境变量' }
      );
    }
  }
  
  /**
   * Windows: 修改用户环境变量 (通过注册表)
   */
  private async addToPathWindows(newPath: string): Promise<void> {
    // 使用 PowerShell 修改用户级 PATH (无需管理员权限)
    const command = `
      $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
      if ($currentPath -notlike "*${newPath}*") {
        [Environment]::SetEnvironmentVariable("Path", "${newPath};$currentPath", "User")
      }
    `;
    
    await execAsync(`powershell -Command "${command}"`);
    
    // 通知系统环境变量已更改
    await execAsync('setx CLAWX_PATH_UPDATED 1');
  }
  
  /**
   * Linux: 添加到 shell profile
   */
  private async addToPathLinux(newPath: string): Promise<void> {
    const shellProfile = this.getShellProfile();
    
    if (shellProfile) {
      const content = existsSync(shellProfile)
        ? readFileSync(shellProfile, 'utf-8')
        : '';
      
      if (!content.includes(newPath)) {
        const exportLine = `\nexport PATH="${newPath}:$PATH"\n`;
        writeFileSync(shellProfile, content + exportLine);
      }
    }
  }
  
  /**
   * 获取当前用户的 shell profile 文件
   */
  private getShellProfile(): string | null {
    const home = homedir();
    const shell = process.env.SHELL || '';
    
    if (shell.includes('zsh')) {
      return join(home, '.zshrc');
    } else if (shell.includes('bash')) {
      const bashProfile = join(home, '.bash_profile');
      const bashrc = join(home, '.bashrc');
      return existsSync(bashProfile) ? bashProfile : bashrc;
    } else if (shell.includes('fish')) {
      return join(home, '.config/fish/config.fish');
    }
    
    // 默认
    return join(home, '.profile');
  }
}
```

#### 2.8.5 设置页面 UI

```typescript
// src/pages/Settings/ProviderSettings.tsx

import { useState, useEffect } from 'react';
import { Eye, EyeOff, Check, AlertCircle } from 'lucide-react';

interface ApiKeyInputProps {
  provider: string;
  label: string;
  placeholder: string;
  hasKey: boolean;
  onSave: (key: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

function ApiKeyInput({ provider, label, placeholder, hasKey, onSave, onDelete }: ApiKeyInputProps) {
  const [value, setValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSave = async () => {
    if (!value.trim()) return;
    
    setSaving(true);
    setError(null);
    
    try {
      await onSave(value);
      setValue(''); // 清空输入，显示"已配置"状态
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      
      {hasKey ? (
        // 已配置状态
        <div className="flex items-center gap-2 p-3 rounded-lg border bg-green-50 dark:bg-green-950 border-green-200">
          <Check className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-700 dark:text-green-400">已配置</span>
          <span className="text-sm text-muted-foreground">••••••••••••</span>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onDelete}>
            删除
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowKey(true)}>
            重新配置
          </Button>
        </div>
      ) : (
        // 未配置状态
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type={showKey ? 'text' : 'password'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
          <Button onClick={handleSave} disabled={saving || !value.trim()}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      )}
      
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      
      <p className="text-xs text-muted-foreground">
        API Key 将安全存储在系统密钥链中，不会以明文保存。
      </p>
    </div>
  );
}

export function ProviderSettings() {
  const [config, setConfig] = useState<any>(null);
  
  useEffect(() => {
    // 从主进程获取配置
    window.electron.ipcRenderer.invoke('env:getConfig').then(setConfig);
  }, []);
  
  const handleSaveApiKey = async (provider: string, key: string) => {
    await window.electron.ipcRenderer.invoke('env:setApiKey', provider, key);
    // 刷新配置
    const newConfig = await window.electron.ipcRenderer.invoke('env:getConfig');
    setConfig(newConfig);
  };
  
  const handleDeleteApiKey = async (provider: string) => {
    await window.electron.ipcRenderer.invoke('env:deleteApiKey', provider);
    const newConfig = await window.electron.ipcRenderer.invoke('env:getConfig');
    setConfig(newConfig);
  };
  
  if (!config) return <LoadingSpinner />;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI 模型配置</CardTitle>
        <CardDescription>
          配置您的 AI 服务提供商 API Key
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ApiKeyInput
          provider="anthropic"
          label="Anthropic (Claude)"
          placeholder="sk-ant-api03-..."
          hasKey={!!config.apiKeys.anthropic}
          onSave={(key) => handleSaveApiKey('anthropic', key)}
          onDelete={() => handleDeleteApiKey('anthropic')}
        />
        
        <Separator />
        
        <ApiKeyInput
          provider="openai"
          label="OpenAI (GPT)"
          placeholder="sk-..."
          hasKey={!!config.apiKeys.openai}
          onSave={(key) => handleSaveApiKey('openai', key)}
          onDelete={() => handleDeleteApiKey('openai')}
        />
        
        <Separator />
        
        <ApiKeyInput
          provider="google"
          label="Google (Gemini)"
          placeholder="AIza..."
          hasKey={!!config.apiKeys.google}
          onSave={(key) => handleSaveApiKey('google', key)}
          onDelete={() => handleDeleteApiKey('google')}
        />
      </CardContent>
    </Card>
  );
}
```

#### 2.8.6 安装向导集成

```typescript
// src/pages/Setup/ProviderStep.tsx

export function ProviderStep({ onNext, onBack }: StepProps) {
  const [selectedProvider, setSelectedProvider] = useState<string>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const providers = [
    { id: 'anthropic', name: 'Anthropic', model: 'Claude', icon: '🤖' },
    { id: 'openai', name: 'OpenAI', model: 'GPT-4', icon: '💚' },
    { id: 'google', name: 'Google', model: 'Gemini', icon: '🔷' },
  ];
  
  const handleNext = async () => {
    if (!apiKey.trim()) {
      setError('请输入 API Key');
      return;
    }
    
    setValidating(true);
    setError(null);
    
    try {
      // 验证 API Key 是否有效
      const valid = await window.electron.ipcRenderer.invoke(
        'provider:validateKey',
        selectedProvider,
        apiKey
      );
      
      if (!valid) {
        setError('API Key 无效，请检查后重试');
        return;
      }
      
      // 安全存储 API Key
      await window.electron.ipcRenderer.invoke(
        'env:setApiKey',
        selectedProvider,
        apiKey
      );
      
      onNext({ provider: selectedProvider });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setValidating(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Label>选择 AI 服务提供商</Label>
        <div className="grid grid-cols-3 gap-4">
          {providers.map((p) => (
            <Card
              key={p.id}
              className={cn(
                'cursor-pointer transition-all p-4',
                selectedProvider === p.id && 'ring-2 ring-primary'
              )}
              onClick={() => setSelectedProvider(p.id)}
            >
              <div className="text-center">
                <span className="text-3xl">{p.icon}</span>
                <p className="font-medium mt-2">{p.name}</p>
                <p className="text-sm text-muted-foreground">{p.model}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
      
      <div className="space-y-2">
        <Label>API Key</Label>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={`输入您的 ${providers.find(p => p.id === selectedProvider)?.name} API Key`}
        />
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        <p className="text-xs text-muted-foreground">
          您的 API Key 将安全存储在系统密钥链中，不会上传到任何服务器。
        </p>
      </div>
      
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>上一步</Button>
        <Button onClick={handleNext} disabled={validating}>
          {validating ? '验证中...' : '下一步'}
        </Button>
      </div>
    </div>
  );
}
```

---

## 三、UI/UX 设计规范

### 3.1 设计原则

| 原则 | 描述 |
|------|------|
| **简洁优先** | 隐藏复杂性，暴露必要功能 |
| **渐进式披露** | 基础功能易达，高级功能可探索 |
| **一致性** | 跨页面/组件保持视觉和交互一致 |
| **响应式反馈** | 所有操作有即时视觉反馈 |
| **原生感** | 遵循各平台设计语言 |

### 3.2 色彩系统

```css
/* src/styles/themes/tokens.css */
:root {
  /* Primary */
  --color-primary-50: #eff6ff;
  --color-primary-500: #3b82f6;
  --color-primary-600: #2563eb;
  
  /* Semantic */
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;
  
  /* Neutral (Light) */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f8fafc;
  --color-text-primary: #0f172a;
  --color-text-secondary: #64748b;
  --color-border: #e2e8f0;
}

[data-theme="dark"] {
  --color-bg-primary: #0f172a;
  --color-bg-secondary: #1e293b;
  --color-text-primary: #f8fafc;
  --color-text-secondary: #94a3b8;
  --color-border: #334155;
}
```

### 3.3 核心页面线框图

```
┌─────────────────────────────────────────────────────────┐
│  ClawX                              ─ □ ×  │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│  ● 概览  │  ┌─────────────┐  ┌─────────────┐           │
│  ○ 对话  │  │   Gateway   │  │   Channels  │           │
│  ○ 通道  │  │   ● 运行中   │  │   3 已连接   │           │
│  ○ 技能  │  └─────────────┘  └─────────────┘           │
│  ○ 设置  │                                              │
│ ○ 定时任务│  ┌───────────────────────────────────────┐   │
│          │  │            最近对话                    │   │
│          │  ├───────────────────────────────────────┤   │
│          │  │ 📱 WhatsApp · 用户A · 2分钟前          │   │
│          │  │ 💬 Telegram · 用户B · 15分钟前         │   │
│          │  │ 💬 Discord · 用户C · 1小时前           │   │
│          │  └───────────────────────────────────────┘   │
│          │                                              │
│          │  ┌───────────────────────────────────────┐   │
│          │  │          快捷操作                      │   │
│          │  │  [添加通道]  [浏览技能]  [查看日志]     │   │
│          │  └───────────────────────────────────────┘   │
│          │                                              │
├──────────┴──────────────────────────────────────────────┤
│  Gateway: 运行中 · 3 通道 · 12 技能 · v2026.2.3        │
└─────────────────────────────────────────────────────────┘
```

### 3.4 定时任务页面设计

```
┌─────────────────────────────────────────────────────────┐
│  ClawX                              ─ □ ×  │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│  ○ 概览  │  定时任务                    [+ 新建任务]    │
│  ○ 对话  │                                              │
│  ○ 通道  │  ┌───────────────────────────────────────┐   │
│  ○ 技能  │  │ 📋 每日天气播报              ● 已启用  │   │
│  ● 定时  │  │ ⏰ 每天 08:00                          │   │
│  ○ 设置  │  │ 📍 发送到: WhatsApp - 家庭群           │   │
│          │  │ 上次执行: 今天 08:00 ✓                 │   │
│          │  │                    [编辑] [暂停] [删除] │   │
│          │  └───────────────────────────────────────┘   │
│          │                                              │
│          │  ┌───────────────────────────────────────┐   │
│          │  │ 📊 周报汇总                   ○ 已暂停  │   │
│          │  │ ⏰ 每周五 18:00                        │   │
│          │  │ 📍 发送到: Telegram - 工作频道         │   │
│          │  │ 上次执行: 上周五 18:00 ✓               │   │
│          │  │                    [编辑] [启用] [删除] │   │
│          │  └───────────────────────────────────────┘   │
│          │                                              │
│          │  ┌───────────────────────────────────────┐   │
│          │  │ 🔔 服务器健康检查             ● 已启用  │   │
│          │  │ ⏰ 每 30 分钟                          │   │
│          │  │ 📍 发送到: Discord - 运维通知          │   │
│          │  │ 上次执行: 10分钟前 ✓                   │   │
│          │  │                    [编辑] [暂停] [删除] │   │
│          │  └───────────────────────────────────────┘   │
│          │                                              │
├──────────┴──────────────────────────────────────────────┤
│  3 个任务 · 2 个运行中 · 1 个暂停                       │
└─────────────────────────────────────────────────────────┘
```

#### 定时任务编辑器弹窗

```
┌─────────────────────────────────────────────────────────┐
│  新建定时任务                                    [×]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  任务名称                                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 每日天气播报                                     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  执行内容 (发送给 AI 的消息)                            │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 请查询北京今天的天气，并生成一条适合发送到群里   │   │
│  │ 的天气播报消息，包含穿衣建议。                   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  执行时间                                               │
│  ┌──────────────┐  ┌────────────────────────────┐     │
│  │ ○ 每天       │  │ 08 : 00                    │     │
│  │ ○ 每周       │  └────────────────────────────┘     │
│  │ ○ 每月       │                                     │
│  │ ○ 自定义Cron │  Cron: 0 8 * * *                   │
│  └──────────────┘                                      │
│                                                         │
│  发送到                                                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │ WhatsApp - 家庭群                           ▼   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ☑ 启用任务                                            │
│                                                         │
│                              [取消]    [保存]          │
└─────────────────────────────────────────────────────────┘
```

#### 定时任务类型定义

```typescript
// src/types/cron.ts

export interface CronJob {
  /** 任务 ID */
  id: string;
  
  /** 任务名称 */
  name: string;
  
  /** 发送给 AI 的消息内容 */
  message: string;
  
  /** Cron 表达式 */
  schedule: string;
  
  /** 目标通道 */
  target: {
    channelType: 'whatsapp' | 'telegram' | 'discord' | 'slack';
    channelId: string;
    channelName: string;
  };
  
  /** 是否启用 */
  enabled: boolean;
  
  /** 创建时间 */
  createdAt: string;
  
  /** 更新时间 */
  updatedAt: string;
  
  /** 上次执行信息 */
  lastRun?: {
    time: string;
    success: boolean;
    error?: string;
  };
  
  /** 下次执行时间 */
  nextRun?: string;
}

export interface CronJobCreateInput {
  name: string;
  message: string;
  schedule: string;
  target: CronJob['target'];
  enabled?: boolean;
}

export interface CronJobUpdateInput {
  name?: string;
  message?: string;
  schedule?: string;
  target?: CronJob['target'];
  enabled?: boolean;
}
```

#### 定时任务 Hook

```typescript
// src/hooks/useCron.ts

import { useState, useEffect, useCallback } from 'react';
import type { CronJob, CronJobCreateInput, CronJobUpdateInput } from '@/types/cron';

export function useCron() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 加载任务列表
  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const result = await window.electron.ipcRenderer.invoke('cron:list');
      setJobs(result);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchJobs();
    
    // 监听任务更新事件
    const handleUpdate = (_: any, updatedJobs: CronJob[]) => {
      setJobs(updatedJobs);
    };
    
    window.electron.ipcRenderer.on('cron:updated', handleUpdate);
    
    return () => {
      window.electron.ipcRenderer.off('cron:updated', handleUpdate);
    };
  }, [fetchJobs]);
  
  // 创建任务
  const createJob = async (input: CronJobCreateInput): Promise<CronJob> => {
    const job = await window.electron.ipcRenderer.invoke('cron:create', input);
    await fetchJobs();
    return job;
  };
  
  // 更新任务
  const updateJob = async (id: string, input: CronJobUpdateInput): Promise<void> => {
    await window.electron.ipcRenderer.invoke('cron:update', id, input);
    await fetchJobs();
  };
  
  // 删除任务
  const deleteJob = async (id: string): Promise<void> => {
    await window.electron.ipcRenderer.invoke('cron:delete', id);
    await fetchJobs();
  };
  
  // 启用/禁用任务
  const toggleJob = async (id: string, enabled: boolean): Promise<void> => {
    await window.electron.ipcRenderer.invoke('cron:toggle', id, enabled);
    await fetchJobs();
  };
  
  // 手动触发任务
  const triggerJob = async (id: string): Promise<void> => {
    await window.electron.ipcRenderer.invoke('cron:trigger', id);
  };
  
  return {
    jobs,
    loading,
    error,
    createJob,
    updateJob,
    deleteJob,
    toggleJob,
    triggerJob,
    refresh: fetchJobs,
  };
}
```

#### 定时任务页面组件

```typescript
// src/pages/Cron/index.tsx

import { useState } from 'react';
import { useCron } from '@/hooks/useCron';
import { CronJobCard } from './CronJobCard';
import { CronEditor } from './CronEditor';
import { Plus, Clock } from 'lucide-react';

export function CronPage() {
  const { jobs, loading, createJob, updateJob, deleteJob, toggleJob } = useCron();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  
  const activeJobs = jobs.filter(j => j.enabled);
  const pausedJobs = jobs.filter(j => !j.enabled);
  
  const handleCreate = () => {
    setEditingJob(null);
    setEditorOpen(true);
  };
  
  const handleEdit = (job: CronJob) => {
    setEditingJob(job);
    setEditorOpen(true);
  };
  
  const handleSave = async (input: CronJobCreateInput) => {
    if (editingJob) {
      await updateJob(editingJob.id, input);
    } else {
      await createJob(input);
    }
    setEditorOpen(false);
  };
  
  if (loading) return <LoadingSpinner />;
  
  return (
    <div className="p-6 space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">定时任务</h1>
          <p className="text-muted-foreground">
            设置自动执行的 AI 任务，按计划发送消息
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          新建任务
        </Button>
      </div>
      
      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{jobs.length}</p>
                <p className="text-sm text-muted-foreground">总任务数</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100">
                <Play className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeJobs.length}</p>
                <p className="text-sm text-muted-foreground">运行中</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-yellow-100">
                <Pause className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pausedJobs.length}</p>
                <p className="text-sm text-muted-foreground">已暂停</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* 任务列表 */}
      {jobs.length === 0 ? (
        <Card className="p-12 text-center">
          <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">暂无定时任务</h3>
          <p className="text-muted-foreground mb-4">
            创建您的第一个定时任务，让 AI 自动为您工作
          </p>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            新建任务
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {jobs.map(job => (
            <CronJobCard
              key={job.id}
              job={job}
              onEdit={() => handleEdit(job)}
              onDelete={() => deleteJob(job.id)}
              onToggle={(enabled) => toggleJob(job.id, enabled)}
            />
          ))}
        </div>
      )}
      
      {/* 编辑器弹窗 */}
      <CronEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
        initialData={editingJob}
      />
    </div>
  );
}
```

#### Cron 表达式选择器

```typescript
// src/pages/Cron/CronSchedulePicker.tsx

import { useState, useEffect } from 'react';

interface CronSchedulePickerProps {
  value: string;
  onChange: (cron: string) => void;
}

type ScheduleType = 'daily' | 'weekly' | 'monthly' | 'interval' | 'custom';

export function CronSchedulePicker({ value, onChange }: CronSchedulePickerProps) {
  const [type, setType] = useState<ScheduleType>('daily');
  const [time, setTime] = useState('08:00');
  const [weekday, setWeekday] = useState(1); // 周一
  const [monthday, setMonthday] = useState(1);
  const [interval, setInterval] = useState(30); // 分钟
  const [customCron, setCustomCron] = useState(value);
  
  // 解析现有 cron 表达式
  useEffect(() => {
    // 简单解析，实际可用 cron-parser 库
    if (value.match(/^\d+ \d+ \* \* \*$/)) {
      setType('daily');
      const [min, hour] = value.split(' ');
      setTime(`${hour.padStart(2, '0')}:${min.padStart(2, '0')}`);
    }
    // ... 其他模式解析
  }, []);
  
  // 生成 cron 表达式
  useEffect(() => {
    let cron = '';
    const [hour, min] = time.split(':');
    
    switch (type) {
      case 'daily':
        cron = `${parseInt(min)} ${parseInt(hour)} * * *`;
        break;
      case 'weekly':
        cron = `${parseInt(min)} ${parseInt(hour)} * * ${weekday}`;
        break;
      case 'monthly':
        cron = `${parseInt(min)} ${parseInt(hour)} ${monthday} * *`;
        break;
      case 'interval':
        cron = `*/${interval} * * * *`;
        break;
      case 'custom':
        cron = customCron;
        break;
    }
    
    if (cron !== value) {
      onChange(cron);
    }
  }, [type, time, weekday, monthday, interval, customCron]);
  
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  
  return (
    <div className="space-y-4">
      {/* 类型选择 */}
      <RadioGroup value={type} onValueChange={(v) => setType(v as ScheduleType)}>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="daily" id="daily" />
          <Label htmlFor="daily">每天</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="weekly" id="weekly" />
          <Label htmlFor="weekly">每周</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="monthly" id="monthly" />
          <Label htmlFor="monthly">每月</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="interval" id="interval" />
          <Label htmlFor="interval">间隔执行</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="custom" id="custom" />
          <Label htmlFor="custom">自定义 Cron</Label>
        </div>
      </RadioGroup>
      
      {/* 时间选择 */}
      {(type === 'daily' || type === 'weekly' || type === 'monthly') && (
        <div className="flex items-center gap-2">
          <Label>执行时间:</Label>
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-32"
          />
        </div>
      )}
      
      {/* 周几选择 */}
      {type === 'weekly' && (
        <div className="flex items-center gap-2">
          <Label>星期:</Label>
          <Select value={String(weekday)} onValueChange={(v) => setWeekday(parseInt(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {weekdays.map((day, i) => (
                <SelectItem key={i} value={String(i)}>{day}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      
      {/* 日期选择 */}
      {type === 'monthly' && (
        <div className="flex items-center gap-2">
          <Label>日期:</Label>
          <Select value={String(monthday)} onValueChange={(v) => setMonthday(parseInt(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <SelectItem key={day} value={String(day)}>{day} 日</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      
      {/* 间隔选择 */}
      {type === 'interval' && (
        <div className="flex items-center gap-2">
          <Label>每隔:</Label>
          <Input
            type="number"
            min={1}
            max={1440}
            value={interval}
            onChange={(e) => setInterval(parseInt(e.target.value))}
            className="w-20"
          />
          <span>分钟</span>
        </div>
      )}
      
      {/* 自定义 Cron */}
      {type === 'custom' && (
        <div className="space-y-2">
          <Input
            value={customCron}
            onChange={(e) => setCustomCron(e.target.value)}
            placeholder="分 时 日 月 周 (如: 0 8 * * 1-5)"
          />
          <p className="text-xs text-muted-foreground">
            Cron 表达式格式: 分钟(0-59) 小时(0-23) 日(1-31) 月(1-12) 周(0-6)
          </p>
        </div>
      )}
      
      {/* 预览 */}
      <div className="p-3 rounded-lg bg-muted">
        <p className="text-sm">
          <span className="text-muted-foreground">Cron 表达式: </span>
          <code className="font-mono">{value}</code>
        </p>
        <p className="text-sm">
          <span className="text-muted-foreground">下次执行: </span>
          {getNextRunTime(value)}
        </p>
      </div>
    </div>
  );
}

function getNextRunTime(cron: string): string {
  // 使用 croner 或类似库计算下次执行时间
  // 这里简化处理
  return '今天 08:00';
}
```

---

## 四、版本规划

### 4.1 版本号策略

```
ClawX 版本: X.Y.Z[-prerelease]
            │ │ │
            │ │ └── Patch: Bug 修复、性能优化
            │ └──── Minor: 新功能、新技能包、UI 改进
            └────── Major: 重大变更、不兼容更新

示例:
- 1.0.0        首个稳定版
- 1.1.0        新增技能市场功能
- 1.1.1        修复 Windows 安装问题
- 2.0.0        UI 重构、新架构
- 1.2.0-beta.1 下一版本测试版
```

### 4.2 OpenClaw 兼容性矩阵

| ClawX 版本 | OpenClaw 版本 | Node.js 版本 | 备注 |
|------------|---------------|--------------|------|
| 1.0.x | 2026.2.x | 22.x | 首发版本 |
| 1.1.x | 2026.3.x | 22.x | 功能增强 |
| 2.0.x | 2026.6.x | 24.x | 大版本升级 |

### 4.3 里程碑规划

#### 🚀 v0.1.0 - Alpha (内部测试)

**目标**: 核心架构验证

| 任务 | 优先级 | 状态 |
|------|--------|------|
| Electron + React 项目骨架 | P0 | ⬜ |
| Gateway 进程管理 | P0 | ⬜ |
| 基础 UI 框架 (侧边栏/布局) | P0 | ⬜ |
| WebSocket 通信层 | P0 | ⬜ |
| 状态管理 (Zustand) | P1 | ⬜ |

**交付物**:
- 可运行的桌面应用
- 能启动/停止 Gateway
- 基础 Dashboard 页面

---

#### 🎯 v0.5.0 - Beta (公开测试)

**目标**: 安装向导 MVP

| 任务 | 优先级 | 状态 |
|------|--------|------|
| 安装向导 UI | P0 | ⬜ |
| Node.js 自动检测/安装 | P0 | ⬜ |
| openclaw npm 安装 | P0 | ⬜ |
| Provider 配置 (API Key) | P0 | ⬜ |
| 错误处理与提示 | P1 | ⬜ |

> **注意**: 通道连接功能 (WhatsApp/Telegram 等) 已从安装向导移至 Settings > Channels 页面。
> 用户可在完成初始设置后，根据需要自行配置消息通道，降低首次使用门槛。

**交付物**:
- 简化版安装向导流程 (不含通道连接)
- 支持 macOS (Apple Silicon + Intel)
- 可配置 Anthropic/OpenAI/OpenRouter

---

#### 📦 v1.0.0 - Stable (首个正式版)

**目标**: 生产可用

| 任务 | 优先级 | 状态 |
|------|--------|------|
| 完整 Dashboard | P0 | ⬜ |
| 通道管理页面 | P0 | ⬜ |
| 对话界面 | P0 | ⬜ |
| 技能浏览/启用 | P0 | ⬜ |
| 设置页面 | P0 | ⬜ |
| 预装技能包选择 | P1 | ⬜ |
| 自动更新 (Sparkle/electron-updater) | P1 | ⬜ |
| Windows 支持 | P1 | ⬜ |
| 深色模式 | P2 | ⬜ |
| 崩溃报告 | P2 | ⬜ |

**交付物**:
- macOS + Windows 安装包
- 自动更新能力
- 用户文档

---

#### 🌟 v1.1.0 - 功能增强

**目标**: 技能生态

| 任务 | 优先级 | 状态 |
|------|--------|------|
| 技能市场 UI | P0 | ⬜ |
| 在线技能安装 | P0 | ⬜ |
| 技能配置界面 | P1 | ⬜ |
| 技能使用统计 | P2 | ⬜ |
| Linux 支持 | P2 | ⬜ |

---

#### 🚀 v2.0.0 - 重大升级

**目标**: 多 Agent / 高级功能

| 任务 | 优先级 | 状态 |
|------|--------|------|
| 多 Agent 支持 | P0 | ⬜ |
| 工作流编排 | P1 | ⬜ |
| 插件 SDK | P1 | ⬜ |
| 自定义主题 | P2 | ⬜ |
| 性能监控面板 | P2 | ⬜ |

---

## 五、开发规范

### 5.1 代码风格

```typescript
// ✅ 命名约定
const MY_CONSTANT = 'value';        // 常量: SCREAMING_SNAKE_CASE
function getUserData() {}           // 函数: camelCase
class GatewayManager {}             // 类: PascalCase
interface ChannelConfig {}          // 接口: PascalCase
type StatusType = 'running';        // 类型: PascalCase

// ✅ 文件命名
// 组件: PascalCase.tsx
// Dashboard.tsx, SkillCard.tsx

// 工具/hooks: kebab-case.ts
// gateway-manager.ts, use-gateway.ts

// ✅ 目录命名
// kebab-case
// src/pages/skill-market/

// ✅ React 组件
export function SkillCard({ skill, onSelect }: SkillCardProps) {
  // hooks 在顶部
  const [loading, setLoading] = useState(false);
  
  // handlers
  const handleClick = () => { /* ... */ };
  
  // render
  return (
    <Card onClick={handleClick}>
      {/* ... */}
    </Card>
  );
}
```

### 5.2 Git 提交规范

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type**:
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档
- `style`: 格式调整
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试
- `chore`: 构建/工具

**示例**:
```
feat(setup): add Node.js auto-installer for Windows

- Detect existing Node.js installation
- Download and install via winget if missing
- Show progress indicator during installation

Closes #123
```

### 5.3 测试策略

```
         /\
        /  \  E2E 测试 (10%)
       /    \  - Playwright
      /──────\  - 完整用户流程
     /        \ - CI 慢速运行
    /──────────\  集成测试 (20%)
   /            \  - Gateway 通信
  /              \ - IPC 调用
 /────────────────\  单元测试 (70%)
/                  \  - Vitest
                    \  - 组件/函数
```

---

## 六、发布流程

### 6.1 发布清单

```bash
# 1. 版本更新
pnpm version <major|minor|patch>

# 2. 更新 Changelog
# 手动编辑 CHANGELOG.md

# 3. 构建检查
pnpm lint && pnpm test && pnpm build

# 4. 打包各平台
pnpm package:mac    # macOS
pnpm package:win    # Windows
pnpm package:linux  # Linux

# 5. 签名 & 公证 (macOS)
pnpm notarize

# 6. 创建 Release
git tag v1.0.0
git push origin v1.0.0
# GitHub Actions 自动发布
```

### 6.2 更新通道

| 通道 | 用途 | 更新频率 |
|------|------|----------|
| `stable` | 正式版 | 每月/按需 |
| `beta` | 测试版 | 每周 |
| `dev` | 开发版 | 每次提交 |

---

## 七、附录

### 7.1 参考资源

| 资源 | 链接 |
|------|------|
| OpenClaw 仓库 | https://github.com/openclaw/openclaw |
| OpenClaw 文档 | https://docs.openclaw.ai |
| Electron 文档 | https://www.electronjs.org/docs |
| shadcn/ui | https://ui.shadcn.com |
| Tailwind CSS | https://tailwindcss.com |

### 7.2 环境变量

```bash
# .env.example

# OpenClaw 配置
OPENCLAW_GATEWAY_PORT=18789

# 开发配置
VITE_DEV_SERVER_PORT=5173

# 发布配置 (CI)
APPLE_ID=your@email.com
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
CSC_LINK=path/to/certificate.p12
CSC_KEY_PASSWORD=certificate_password
GH_TOKEN=github_personal_access_token
```

### 7.3 常用命令

```bash
# 开发
pnpm dev           # 启动开发服务器
pnpm dev:main      # 仅启动 Electron 主进程
pnpm dev:renderer  # 仅启动 React 开发服务器

# 构建
pnpm build         # 构建生产版本
pnpm build:main    # 构建主进程
pnpm build:renderer # 构建渲染进程

# 打包
pnpm package       # 打包当前平台
pnpm package:mac   # 打包 macOS
pnpm package:win   # 打包 Windows
pnpm package:linux # 打包 Linux
pnpm package:all   # 打包所有平台

# 测试
pnpm test          # 运行单元测试
pnpm test:e2e      # 运行 E2E 测试
pnpm test:coverage # 生成覆盖率报告

# 代码质量
pnpm lint          # 检查代码规范
pnpm lint:fix      # 自动修复
pnpm typecheck     # TypeScript 类型检查
```

---
