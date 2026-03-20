#!/bin/bash
# ============================================
# 🔭 MacroLens 一键部署脚本
# ============================================

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${BLUE}${BOLD}  🔭 MacroLens — 宏观新闻情绪分析平台${NC}"
echo -e "${CYAN}  ────────────────────────────────────${NC}"
echo ""

# ---- Check Docker ----
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ 未检测到 Docker，请先安装 Docker Desktop${NC}"
    echo "   https://www.docker.com/products/docker-desktop"
    exit 1
fi
if ! docker info &> /dev/null 2>&1; then
    echo -e "${RED}❌ Docker 未运行，请先启动 Docker Desktop${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Docker 已就绪"

# ---- Check docker-compose ----
if command -v docker-compose &> /dev/null; then
    COMPOSE="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    COMPOSE="docker compose"
else
    echo -e "${RED}❌ 未检测到 docker-compose${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} $COMPOSE 已就绪"
echo ""

# ---- Load existing .env if present ----
declare -A EXISTING
if [ -f .env ]; then
    while IFS='=' read -r key value; do
        [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
        EXISTING["$key"]="$value"
    done < .env
fi

# ---- Helper: prompt with default ----
prompt_key() {
    local var_name="$1"
    local display_name="$2"
    local hint="$3"
    local required="$4"
    local default="${EXISTING[$var_name]}"
    local masked=""

    if [ -n "$default" ]; then
        masked="${default:0:4}...${default: -4}"
        echo -en "  ${BOLD}${display_name}${NC} ${CYAN}[已配置: ${masked}]${NC}"
        echo -en "\n  回车保留现有值，或输入新值: "
    else
        echo -en "  ${BOLD}${display_name}${NC}"
        [ -n "$hint" ] && echo -en " ${CYAN}(${hint})${NC}"
        [ "$required" = "required" ] && echo -en " ${RED}*${NC}"
        echo -en ": "
    fi

    read -r input
    if [ -n "$input" ]; then
        eval "$var_name='$input'"
    elif [ -n "$default" ]; then
        eval "$var_name='$default'"
    else
        eval "$var_name=''"
    fi
}

# ============================================
# Step 1: 新闻源 API Keys
# ============================================
echo -e "${YELLOW}${BOLD}📰 第一步：配置新闻源 API Keys${NC}"
echo -e "  ${CYAN}至少配置一个新闻源，推荐全部配置以获得最全的新闻覆盖${NC}"
echo ""

prompt_key "FINNHUB_API_KEY" "Finnhub API Key" "https://finnhub.io 免费注册, 60次/分钟" "recommended"
prompt_key "NEWSAPI_API_KEY" "NewsAPI API Key" "https://newsapi.org 免费注册, 100次/天" ""
prompt_key "GNEWS_API_KEY" "GNews API Key" "https://gnews.io 免费注册, 100次/天" ""

has_news=false
[ -n "$FINNHUB_API_KEY" ] && has_news=true
[ -n "$NEWSAPI_API_KEY" ] && has_news=true
[ -n "$GNEWS_API_KEY" ] && has_news=true

if [ "$has_news" = false ]; then
    echo -e "\n  ${RED}⚠ 未配置任何新闻源，系统将无法获取新闻${NC}"
    echo -en "  是否继续？(y/N): "
    read -r cont
    [ "$cont" != "y" ] && exit 0
fi
echo ""

# ============================================
# Step 2: LLM 模型配置
# ============================================
echo -e "${YELLOW}${BOLD}🤖 第二步：配置 AI 分析模型${NC}"
echo -e "  ${CYAN}选择一个 LLM 提供商用于新闻情绪分析和中文翻译${NC}"
echo ""

echo "  可选提供商:"
echo -e "    ${BOLD}1${NC}) OpenAI (GPT-4o, GPT-4o-mini 等)"
echo -e "    ${BOLD}2${NC}) Anthropic (Claude)"
echo -e "    ${BOLD}3${NC}) xAI Grok"
echo -e "    ${BOLD}4${NC}) Ollama (本地模型, 无需 API Key)"
echo -e "    ${BOLD}5${NC}) 自定义 OpenAI 兼容接口"
echo ""
echo -en "  选择提供商 [1-5]: "
read -r provider_choice

case "$provider_choice" in
    1)
        DEFAULT_LLM_PROVIDER="openai"
        prompt_key "OPENAI_API_KEY" "OpenAI API Key" "sk-..." "required"
        DEFAULT_LLM_API_KEY="$OPENAI_API_KEY"
        OPENAI_BASE_URL="${EXISTING[OPENAI_BASE_URL]:-https://api.openai.com/v1}"
        echo -en "  ${BOLD}模型名称${NC} ${CYAN}[默认: gpt-4o-mini]${NC}: "
        read -r model_input
        DEFAULT_LLM_MODEL="${model_input:-gpt-4o-mini}"
        ;;
    2)
        DEFAULT_LLM_PROVIDER="anthropic"
        prompt_key "ANTHROPIC_API_KEY" "Anthropic API Key" "" "required"
        DEFAULT_LLM_API_KEY="$ANTHROPIC_API_KEY"
        echo -en "  ${BOLD}模型名称${NC} ${CYAN}[默认: claude-sonnet-4-20250514]${NC}: "
        read -r model_input
        DEFAULT_LLM_MODEL="${model_input:-claude-sonnet-4-20250514}"
        ;;
    3)
        DEFAULT_LLM_PROVIDER="grok"
        prompt_key "GROK_API_KEY" "Grok API Key" "" "required"
        DEFAULT_LLM_API_KEY="$GROK_API_KEY"
        GROK_BASE_URL="${EXISTING[GROK_BASE_URL]:-https://api.x.ai/v1}"
        echo -en "  ${BOLD}Grok Base URL${NC} ${CYAN}[默认: ${GROK_BASE_URL}]${NC}: "
        read -r grok_url_input
        GROK_BASE_URL="${grok_url_input:-$GROK_BASE_URL}"
        echo -en "  ${BOLD}模型名称${NC} ${CYAN}[默认: grok-beta]${NC}: "
        read -r model_input
        DEFAULT_LLM_MODEL="${model_input:-grok-beta}"
        ;;
    4)
        DEFAULT_LLM_PROVIDER="ollama"
        DEFAULT_LLM_API_KEY=""
        echo -en "  ${BOLD}Ollama Base URL${NC} ${CYAN}[默认: http://host.docker.internal:11434]${NC}: "
        read -r ollama_url
        OLLAMA_BASE_URL="${ollama_url:-http://host.docker.internal:11434}"
        echo -en "  ${BOLD}模型名称${NC} ${CYAN}[默认: llama3]${NC}: "
        read -r model_input
        DEFAULT_LLM_MODEL="${model_input:-llama3}"
        ;;
    5)
        DEFAULT_LLM_PROVIDER="openai"
        echo -en "  ${BOLD}自定义 API Base URL${NC}: "
        read -r custom_url
        OPENAI_BASE_URL="${custom_url}"
        prompt_key "OPENAI_API_KEY" "API Key" "" "required"
        DEFAULT_LLM_API_KEY="$OPENAI_API_KEY"
        echo -en "  ${BOLD}模型名称${NC}: "
        read -r model_input
        DEFAULT_LLM_MODEL="${model_input:-gpt-4o-mini}"
        ;;
    *)
        echo -e "${RED}无效选择${NC}"
        exit 1
        ;;
esac
echo ""

# ============================================
# Step 3: X/推特情绪监控 (可选)
# ============================================
echo -e "${YELLOW}${BOLD}🐦 第三步：X/推特情绪监控 (可选)${NC}"
echo -e "  ${CYAN}使用 Grok 模型分析 X/推特上的散户情绪和热门讨论${NC}"
echo ""

if [ -z "$GROK_API_KEY" ]; then
    prompt_key "GROK_API_KEY" "Grok API Key" "跳过则不启用 X 情绪监控" ""
fi
if [ -n "$GROK_API_KEY" ] && [ -z "$GROK_BASE_URL" ]; then
    GROK_BASE_URL="${EXISTING[GROK_BASE_URL]:-https://api.x.ai/v1}"
    echo -en "  ${BOLD}Grok Base URL${NC} ${CYAN}[默认: ${GROK_BASE_URL}]${NC}: "
    read -r grok_url_input
    GROK_BASE_URL="${grok_url_input:-$GROK_BASE_URL}"
fi
echo ""

# ============================================
# Step 4: 高级设置
# ============================================
echo -e "${YELLOW}${BOLD}⚙️  第四步：高级设置${NC}"
echo ""
echo -en "  ${BOLD}新闻拉取间隔(秒)${NC} ${CYAN}[默认: 60]${NC}: "
read -r poll_input
NEWS_POLL_INTERVAL="${poll_input:-60}"

echo -en "  ${BOLD}每批分析数量${NC} ${CYAN}[默认: 10]${NC}: "
read -r batch_input
ANALYSIS_BATCH_SIZE="${batch_input:-10}"
echo ""

# ============================================
# Generate .env
# ============================================
cat > .env << ENVEOF
# ============================================
# MacroLens - 宏观新闻情绪分析平台
# Generated by setup.sh at $(date '+%Y-%m-%d %H:%M:%S')
# ============================================

# ---------- 新闻源 API Keys ----------
FINNHUB_API_KEY=${FINNHUB_API_KEY}
NEWSAPI_API_KEY=${NEWSAPI_API_KEY}
GNEWS_API_KEY=${GNEWS_API_KEY}

# ---------- 默认 LLM 配置 ----------
DEFAULT_LLM_PROVIDER=${DEFAULT_LLM_PROVIDER}
DEFAULT_LLM_MODEL=${DEFAULT_LLM_MODEL}
DEFAULT_LLM_API_KEY=${DEFAULT_LLM_API_KEY}

# ---------- LLM Provider Keys & URLs ----------
OPENAI_API_KEY=${OPENAI_API_KEY:-${DEFAULT_LLM_API_KEY}}
OPENAI_BASE_URL=${OPENAI_BASE_URL:-https://api.openai.com/v1}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
GROK_API_KEY=${GROK_API_KEY}
GROK_BASE_URL=${GROK_BASE_URL:-https://api.x.ai/v1}
OLLAMA_BASE_URL=${OLLAMA_BASE_URL:-http://host.docker.internal:11434}

# ---------- 应用设置 ----------
NEWS_POLL_INTERVAL=${NEWS_POLL_INTERVAL}
ANALYSIS_BATCH_SIZE=${ANALYSIS_BATCH_SIZE}
ENVEOF

echo -e "${GREEN}✓${NC} .env 配置文件已生成"
echo ""

# ============================================
# Summary
# ============================================
echo -e "${BLUE}${BOLD}  📋 配置摘要${NC}"
echo -e "  ${CYAN}────────────────────────────────${NC}"
echo -en "  新闻源:    "
[ -n "$FINNHUB_API_KEY" ] && echo -en "${GREEN}Finnhub ✓${NC}  "
[ -n "$NEWSAPI_API_KEY" ] && echo -en "${GREEN}NewsAPI ✓${NC}  "
[ -n "$GNEWS_API_KEY" ] && echo -en "${GREEN}GNews ✓${NC}  "
echo ""
echo -e "  LLM:       ${GREEN}${DEFAULT_LLM_PROVIDER} / ${DEFAULT_LLM_MODEL}${NC}"
[ -n "$GROK_API_KEY" ] && echo -e "  X 情绪:    ${GREEN}已启用${NC}" || echo -e "  X 情绪:    ${YELLOW}未启用${NC}"
echo -e "  拉取间隔:  ${NEWS_POLL_INTERVAL}s"
echo -e "  分析批量:  ${ANALYSIS_BATCH_SIZE}"
echo ""

# ============================================
# Start
# ============================================
echo -en "${BOLD}是否立即启动 MacroLens？(Y/n): ${NC}"
read -r start_choice

if [ "$start_choice" != "n" ] && [ "$start_choice" != "N" ]; then
    echo ""
    echo -e "${BLUE}🚀 正在构建并启动...${NC}"
    echo ""
    $COMPOSE up -d --build

    echo ""
    echo -e "${GREEN}${BOLD}  ✅ MacroLens 已启动！${NC}"
    echo ""
    echo -e "  ${BOLD}前端面板:${NC}  ${CYAN}http://localhost:3000${NC}"
    echo -e "  ${BOLD}后端 API:${NC}  ${CYAN}http://localhost:8000${NC}"
    echo -e "  ${BOLD}API 文档:${NC}  ${CYAN}http://localhost:8000/docs${NC}"
    echo ""
    echo -e "  ${YELLOW}首次启动后，系统会自动拉取新闻并开始 AI 分析${NC}"
    echo -e "  ${YELLOW}通常需要 1-2 分钟才能看到第一批分析结果${NC}"
    echo ""
    echo -e "  停止: ${CYAN}$COMPOSE down${NC}"
    echo -e "  日志: ${CYAN}$COMPOSE logs -f${NC}"
else
    echo ""
    echo -e "  配置已保存到 ${CYAN}.env${NC}"
    echo -e "  稍后运行 ${CYAN}$COMPOSE up -d --build${NC} 启动"
fi

echo ""
