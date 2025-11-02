# Setting Up Your Playerbot Development Environment

**Tags**: [getting-started, setup, development, environment, cmake]
**Difficulty**: basic
**Category**: getting_started

## Overview

This guide walks through setting up a complete TrinityCore Playerbot development environment on Windows, Linux, and macOS.

## Prerequisites

### Software Requirements

- **CMake**: 3.24 or higher
- **C++ Compiler**:
  - Windows: Visual Studio 2022 (17.4+)
  - Linux: GCC 11+ or Clang 14+
  - macOS: Xcode 14+ (Apple Clang)
- **MySQL**: 9.4.0 or higher
- **Boost**: 1.74.0 or higher
- **Git**: Latest version

### Hardware Requirements

- **CPU**: 4+ cores recommended
- **RAM**: 8GB minimum, 16GB recommended
- **Disk**: 50GB+ free space
- **Network**: Internet connection for dependencies

## Step 1: Clone Repository

```bash
# Clone TrinityCore with Playerbot
git clone --recursive https://github.com/TrinityCore/TrinityCore.git
cd TrinityCore

# Switch to playerbot branch
git checkout playerbot
git submodule update --init --recursive
```

## Step 2: Install Dependencies

### Windows

```powershell
# Install Chocolatey (if not already installed)
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

# Install dependencies
choco install cmake git mysql boost-msvc-14.3
```

### Linux (Ubuntu 22.04+)

```bash
sudo apt update
sudo apt install -y git cmake build-essential \
  libmysqlclient-dev libssl-dev libboost-all-dev \
  libreadline-dev zlib1g-dev libbz2-dev
```

### macOS

```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install cmake boost mysql git
```

## Step 3: Configure Build

### Windows (Visual Studio)

```powershell
# Create build directory
mkdir build
cd build

# Configure with CMake
cmake .. -G "Visual Studio 17 2022" -A x64 `
  -DCMAKE_INSTALL_PREFIX="C:\TrinityCore" `
  -DTOOLS=1 `
  -DSCRIPTS=static `
  -DPLAYERBOT=1

# Open TrinityCore.sln in Visual Studio
```

### Linux/macOS (Make)

```bash
# Create build directory
mkdir build && cd build

# Configure with CMake
cmake .. -DCMAKE_INSTALL_PREFIX=/opt/trinitycore \
  -DCMAKE_BUILD_TYPE=RelWithDebInfo \
  -DTOOLS=1 \
  -DSCRIPTS=static \
  -DPLAYERBOT=1 \
  -DCMAKE_C_COMPILER=/usr/bin/gcc-11 \
  -DCMAKE_CXX_COMPILER=/usr/bin/g++-11
```

## Step 4: Build TrinityCore

### Windows

```powershell
# Build in Visual Studio (Ctrl+Shift+B)
# Or via command line:
cmake --build . --config RelWithDebInfo --parallel 8
```

### Linux/macOS

```bash
# Build with make
make -j$(nproc)

# Install
sudo make install
```

**Build Time**: 30-60 minutes (first build)

## Step 5: Configure Playerbot

### Enable Playerbot Module

Edit `worldserver.conf`:

```ini
[worldserver.conf]

# Enable Playerbot module
Playerbot.Enabled = 1

# Bot performance settings
Playerbot.MaxBots = 100
Playerbot.UpdateInterval = 100
Playerbot.AIUpdateDelay = 50

# Bot behavior settings
Playerbot.AllowPlayerBots = 1
Playerbot.BotAutologin = 0
Playerbot.RandomBotAutologin = 0

# Performance optimization
Playerbot.ThreadCount = 4
Playerbot.AsyncQueries = 1
```

## Step 6: Initialize Database

```sql
-- Create playerbot tables
SOURCE sql/custom/playerbot/playerbot.sql;

-- Grant permissions
GRANT ALL PRIVILEGES ON world.* TO 'trinity'@'localhost';
FLUSH PRIVILEGES;
```

## Step 7: Verify Installation

```bash
# Start worldserver
./worldserver

# Check for Playerbot initialization
# Should see: "Playerbot system initialized. Ready for 100 bots."
```

## Development Workflow

### 1. Make Code Changes

Edit files in `src/modules/Playerbot/`:

```cpp
// src/modules/Playerbot/AI/BotAI.cpp
void BotAI::Update(uint32 diff) {
    // Your changes here
}
```

### 2. Rebuild

```bash
# Incremental build (much faster than full build)
cmake --build . --config RelWithDebInfo --target worldserver

# Build time: 10-30 seconds for small changes
```

### 3. Test

```bash
# Restart worldserver
./worldserver

# Test your changes
```

## Debugging Setup

### Visual Studio (Windows)

1. Set `worldserver` as startup project
2. Configure command arguments in project properties:
   ```
   -c C:\TrinityCore\etc\worldserver.conf
   ```
3. Set breakpoints in Playerbot code
4. Press F5 to debug

### GDB (Linux)

```bash
# Build with debug symbols
cmake .. -DCMAKE_BUILD_TYPE=Debug

# Run with GDB
gdb ./worldserver
(gdb) break BotAI::Update
(gdb) run
```

### LLDB (macOS)

```bash
# Build with debug symbols
cmake .. -DCMAKE_BUILD_TYPE=Debug

# Run with LLDB
lldb ./worldserver
(lldb) breakpoint set --name BotAI::Update
(lldb) run
```

## Performance Profiling

### Windows (Visual Studio Profiler)

1. Analyze → Performance Profiler
2. Select "CPU Usage"
3. Start profiling
4. Spawn 100 bots
5. Stop and analyze results

### Linux (perf)

```bash
# Install perf
sudo apt install linux-tools-common linux-tools-generic

# Profile worldserver
sudo perf record -g ./worldserver
sudo perf report
```

## Troubleshooting

### Issue 1: CMake can't find Boost

**Solution**:
```bash
# Windows
set BOOST_ROOT=C:\local\boost_1_74_0

# Linux/macOS
cmake .. -DBOOST_ROOT=/usr/local/opt/boost
```

### Issue 2: MySQL connection failed

**Solution**:
```sql
-- Check MySQL is running
sudo systemctl status mysql

-- Reset password
ALTER USER 'trinity'@'localhost' IDENTIFIED BY 'trinity';
FLUSH PRIVILEGES;
```

### Issue 3: Playerbot module not loading

**Solution**:
```bash
# Check worldserver.conf has Playerbot.Enabled = 1
# Check playerbot.sql was imported
# Check worldserver logs for error messages
```

## Next Steps

- Read [03_bot_lifecycle.md](03_bot_lifecycle.md)
- Learn [04_first_bot_ai.md](04_first_bot_ai.md)
- Explore [../patterns/combat/01_combat_ai_strategy.md](../patterns/combat/01_combat_ai_strategy.md)

## Related Documents

- [Build System Overview](../workflows/01_build_workflow.md)
- [Debugging Techniques](../troubleshooting/01_debugging_basics.md)
- [Performance Optimization](../advanced/02_performance_optimization.md)

## Version History

- **v2.0.0** (2025-10-31): Updated for Phase 5 knowledge base
- **v1.0.0** (2025-10-28): Initial setup guide
