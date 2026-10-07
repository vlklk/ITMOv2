.PHONY: install test models ask ask-strict experiment
Q ?= Как запустить тесты? Укажи файл-источник.

install:
	@python3 -c "import sys; assert sys.version_info >= (3,10), 'Python 3.10+ required'; print('Standard library only: ready')"
test: install
	$(MAKE) -C demo test

# Собрать оба профиля из Modelfile: чат 4k и агент для OpenCode 64k.
models:
	ollama create itmo-chat -f Modelfile
	ollama create itmo-agent -f Modelfile.agent

# Вопрос локальной модели через OpenCode (агент local-guide, только чтение), новая сессия.
ask:
	python3 ask_local.py --name demo_$$(date +%H%M%S) "$(Q)"
ask-strict:
	python3 ask_local.py --agent local-guide-strict --name demo_$$(date +%H%M%S) "$(Q)"

# Контролируемый эксперимент через Ollama API, вопрос про CI (ответа в README нет):
# baseline — без инструкций, system — system.txt в запросе, modelfile — SYSTEM из Modelfile (itmo-chat).
experiment:
	python3 experiment.py --mode baseline --model qwen3.5:9b --output results/exp_baseline_$$(date +%H%M%S).json
	python3 experiment.py --mode system --model qwen3.5:9b --output results/exp_system_$$(date +%H%M%S).json
	python3 experiment.py --mode baseline --model itmo-chat --output results/exp_modelfile_$$(date +%H%M%S).json
