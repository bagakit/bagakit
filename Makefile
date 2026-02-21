SHELL := /usr/bin/env bash

ROOT := $(shell cd "$(dir $(lastword $(MAKEFILE_LIST)))" && pwd)
SCRIPTS := $(ROOT)/scripts
DIST_DIR ?= dist

.PHONY: help package-all package-one validate validate-fast render-catalog update update-remote release clean

help:
	@echo "Targets:"
	@echo "  make package-all                 # package all skills into dist/ (.skill + expanded dirs)"
	@echo "  make package-one SKILL=<name>    # package one skill into dist/ (.skill + expanded dir)"
	@echo "  make validate                    # render catalog + validate profiles + run skill tests"
	@echo "  make validate-fast               # validate without running skill tests"
	@echo "  make render-catalog              # regenerate catalog/skills.json"
	@echo "  make update                      # sync submodules to pinned commits"
	@echo "  make update-remote [SKILL=name]  # bump all (or one) submodule to origin/main"
	@echo "  make release VERSION=vYYYY.MM.DD # run release workflow"
	@echo "  make clean                       # remove dist/"

package-all:
	"$(SCRIPTS)/package-all-skills.sh" --dist "$(DIST_DIR)"

package-one:
	@if [[ -z "$(SKILL)" ]]; then \
		echo "Usage: make package-one SKILL=<name-or-path>" >&2; \
		exit 1; \
	fi
	"$(SCRIPTS)/package-all-skills.sh" --dist "$(DIST_DIR)" --skill "$(SKILL)" --no-clean

validate:
	"$(SCRIPTS)/validate.sh"

validate-fast:
	"$(SCRIPTS)/validate.sh" --skip-tests

render-catalog:
	"$(SCRIPTS)/render_catalog.sh"

update:
	"$(SCRIPTS)/update.sh"

update-remote:
	@if [[ -n "$(SKILL)" ]]; then \
		"$(SCRIPTS)/update.sh" --remote --skill "$(SKILL)"; \
	else \
		"$(SCRIPTS)/update.sh" --remote; \
	fi

release:
	@if [[ -z "$(VERSION)" ]]; then \
		echo "Usage: make release VERSION=<tag>" >&2; \
		exit 1; \
	fi
	"$(SCRIPTS)/release.sh" "$(VERSION)"

clean:
	rm -rf "$(DIST_DIR)"
