# 便携版打包说明

## 重要说明

Tauri 2.x 版本不支持原生的 `portable` bundle 类型。我们通过以下方式创建便携版：

1. 构建发布版本（生成 .exe 和资源文件）
2. 手动打包成 ZIP 文件
3. 用户解压后即可运行

## 快速开始

### 使用打包脚本（推荐）

**Windows CMD:**
```bash
build-portable.bat
```

脚本会自动：
1. 检查 Node.js 和 Rust 环境
2. 安装依赖
3. 构建发布版本
4. 创建 `portable-build` 目录
5. 复制所有必要文件
6. 生成 README.txt

### 手动构建

```bash
# 1. 构建发布版本
npm run tauri:build

# 2. 找到生成的文件
# src-tauri/target/release/nice-chinese-chess.exe (主程序)
# src-tauri/target/release/resources/ (资源文件)

# 3. 手动打包
# 创建文件夹，复制以下内容：
# - nice-chinese-chess.exe
# - resources/ 目录
# - pikafish/ 目录 (AI引擎)
```

## 输出文件位置

### 构建产物

```
src-tauri/target/release/
├── nice-chinese-chess.exe    # 主程序
├── resources/                 # 资源文件
│   ├── fonts/                # 字体文件
│   └── ...
└── ...

src-tauri/public/pikafish/     # AI引擎
├── pikafish-avx2.exe
├── pikafish.nnue
└── ...
```

### 便携版目录结构

```
portable-build/
├── nice-chinese-chess.exe     # 主程序
├── resources/                  # 资源文件
│   └── fonts/                 # 字体文件
├── pikafish/                   # AI引擎
│   ├── pikafish-avx2.exe
│   ├── pikafish.nnue
│   └── ...
└── README.txt                  # 使用说明
```

## 打包分发

### 方法 1：使用脚本自动打包

运行 `build-portable.bat` 后，会生成 `portable-build` 目录。

### 方法 2：手动打包

1. 创建新文件夹，命名为 `NiceChineseChess_Portable`
2. 复制以下文件：
   ```
   src-tauri\target\release\nice-chinese-chess.exe
   src-tauri\target\release\resources\ (整个目录)
   src-tauri\public\pikafish\ (整个目录)
   ```
3. 右键文件夹 → 发送到 → 压缩(zipped)文件夹
4. 或使用 7-Zip 等工具压缩

## 便携版特点

✅ **解压即用**：解压 ZIP 后直接运行
✅ **绿色便携**：可放在 U 盘或任意目录
✅ **配置独立**：配置文件保存在程序同目录
✅ **无注册表污染**：不写入 Windows 注册表
✅ **完整功能**：包含所有依赖和 AI 引擎

## 使用说明

1. 解压 ZIP 文件到任意目录
2. 双击 `nice-chinese-chess.exe` 运行
3. 首次运行会在同目录创建 `config.yaml` 配置文件
4. 棋谱文件可放在 `assets/chess_score/` 目录

## 系统要求

- Windows 10 或更高版本
- 64 位系统（x64）
- 无需安装 .NET Framework 或其他运行时

## 打包前准备

确保已安装：

1. **Node.js 16+**
   ```bash
   node --version
   ```

2. **Rust 工具链**
   ```bash
   rustc --version
   cargo --version
   ```

3. **Visual Studio Build Tools** (Windows)
   - 包含 MSVC 编译器
   - 包含 Windows SDK

## 常见问题

### Q: 为什么没有单个 .exe 文件？

A: Tauri 2.x 不支持单文件打包模式。便携版需要包含：
- 主程序 .exe
- resources/ 目录（字体、资源）
- pikafish/ 目录（AI引擎）

### Q: 打包后的文件很大？

A: 这是正常的，因为包含了：
- Chromium 浏览器引擎（约 80MB）
- Vue 3 前端框架
- Three.js 3D 引擎
- Pikafish AI 引擎
- 所有依赖库

### Q: 能否减小文件大小？

A: 可以尝试：
1. 只保留一个 AI 引擎版本（如 pikafish-avx2.exe）
2. 删除不需要的字体文件
3. 使用 UPX 压缩可执行文件（不推荐，可能触发杀毒软件）

### Q: 如何分发便携版？

A: 推荐：
1. 压缩成 ZIP 文件
2. 上传到网盘或 GitHub Releases
3. 用户下载后解压运行

### Q: 安装版和便携版有什么区别？

A: 
- **安装版**：有开始菜单快捷方式、文件关联、自动更新
- **便携版**：解压即用、配置独立、适合U盘携带

## 分发建议

便携版适合：
- ✅ U 盘携带
- ✅ 网盘分享
- ✅ 不想安装软件的用户
- ✅ 测试和体验

安装版适合：
- ✅ 长期使用
- ✅ 需要开始菜单快捷方式
- ✅ 需要文件关联
- ✅ 需要自动更新

## 技术细节

便携版构建流程：
1. `cargo build --release` 编译 Rust 代码
2. `vite build` 构建前端资源
3. Tauri 打包成可执行文件
4. 复制资源文件到 resources/ 目录
5. 手动打包成 ZIP 文件

---

**最后更新**: 2026-05-08
