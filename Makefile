SHELL := /usr/bin/env bash

ROOT := $(shell cd "$(dir $(lastword $(MAKEFILE_LIST)))" && pwd)
SCRIPTS := $(ROOT)/scripts
PACKAGE_SOURCE ?= submodule
DIST_DIR ?= $(if $(filter local,$(PACKAGE_SOURCE)),dist_local,dist)

.PHONY: help package-all package-all-local package-one package-one-local validate validate-fast render-catalog update update-remote release project-skill-add clean

help:
	@echo "Targets:"
	@echo "  make package-all [PACKAGE_SOURCE=submodule|local] [DIST_DIR=...]"
	@echo "                                   # package all skills (default: submodule -> dist/, local -> dist_local/)"
	@echo "  make package-all-local           # package all skills from local repos into dist_local/"
	@echo "  make package-one SKILL=<name>    # package one skill (honors PACKAGE_SOURCE + DIST_DIR)"
	@echo "  make package-one-local SKILL=<name>"
	@echo "                                   # package one skill from local repos into dist_local/"
	@echo "  make validate                    # render catalog + validate profiles + run skill tests"
	@echo "  make validate-fast               # validate without running skill tests"
	@echo "  make render-catalog              # regenerate catalog/skills.json"
	@echo "  make update                      # sync submodules to pinned commits"
	@echo "  make update-remote [SKILL=name]  # bump all (or one) submodule to origin/main"
	@echo "  make project-skill-add PROJECT=<project> REPO=<url> SKILL_ID=<id> SKILL_PATH=<path> [REGISTER_ONLY=1]"
	@echo "  make release VERSION=vYYYY.MM.DD # run release workflow"
	@echo "  make clean                       # remove dist/ and dist_local/"

package-all:
	"$(SCRIPTS)/package-all-skills.sh" --source "$(PACKAGE_SOURCE)" --dist "$(DIST_DIR)"

package-all-local:
	"$(SCRIPTS)/package-all-skills.sh" --source local --dist dist_local

package-one:
	@if [[ -z "$(SKILL)" ]]; then \
		echo "Usage: make package-one SKILL=<name-or-path>" >&2; \
		exit 1; \
	fi
	"$(SCRIPTS)/package-all-skills.sh" --source "$(PACKAGE_SOURCE)" --dist "$(DIST_DIR)" --skill "$(SKILL)" --no-clean

package-one-local:
	@if [[ -z "$(SKILL)" ]]; then \
		echo "Usage: make package-one-local SKILL=<name-or-path>" >&2; \
		exit 1; \
	fi
	"$(SCRIPTS)/package-all-skills.sh" --source local --dist dist_local --skill "$(SKILL)" --no-clean

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

project-skill-add:
	@if [[ -z "$(PROJECT)" || -z "$(SKILL_ID)" || -z "$(SKILL_PATH)" ]]; then \
		echo "Usage: make project-skill-add PROJECT=<project> REPO=<url> SKILL_ID=<id> SKILL_PATH=<path> [REGISTER_ONLY=1]" >&2; \
		exit 1; \
	fi
	@args=(--project "$(PROJECT)" --skill-id "$(SKILL_ID)" --skill-path "$(SKILL_PATH)"); \
	if [[ "$(REGISTER_ONLY)" == "1" ]]; then \
		args+=(--register-only); \
	else \
		if [[ -z "$(REPO)" ]]; then \
			echo "REPO is required unless REGISTER_ONLY=1" >&2; \
			exit 1; \
		fi; \
		args+=(--repo "$(REPO)"); \
	fi; \
	if [[ -n "$(SUBMODULE_PATH)" ]]; then args+=(--submodule-path "$(SUBMODULE_PATH)"); fi; \
	if [[ -n "$(BRANCH)" ]]; then args+=(--branch "$(BRANCH)"); fi; \
	if [[ -n "$(LAYER)" ]]; then args+=(--layer "$(LAYER)"); fi; \
	if [[ -n "$(GROUP)" ]]; then args+=(--group "$(GROUP)"); fi; \
	if [[ -n "$(TIER)" ]]; then args+=(--tier "$(TIER)"); fi; \
	"$(SCRIPTS)/add-project-skill-submodule.sh" "$${args[@]}"

release:
	@if [[ -z "$(VERSION)" ]]; then \
		echo "Usage: make release VERSION=<tag>" >&2; \
		exit 1; \
	fi
	"$(SCRIPTS)/release.sh" "$(VERSION)"

clean:
	rm -rf dist dist_local
