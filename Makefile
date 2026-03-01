SHELL := /usr/bin/env bash

ROOT := $(shell cd "$(dir $(lastword $(MAKEFILE_LIST)))" && pwd)
SCRIPTS := $(ROOT)/scripts
DIST_DIR ?= dist/skill-packages

.PHONY: help package-all package-one validate validate-fast validate-repo clean

help:
	@echo "Targets:"
	@echo "  make validate-repo               # gate validate (primary)"
	@echo "  make validate                    # alias of validate-repo"
	@echo "  make validate-fast               # same as validate-repo for now"
	@echo "  make package-all [DIST_DIR=...]         # write .skill archives for discovered installable skill sources"
	@echo "  make package-one SELECTOR=<selector>    # write .skill archives for one selector"
	@echo "  make clean                       # remove dist/"

package-all:
	cd scripts && bash skill.sh distribute-package --dist "$(DIST_DIR)"

package-one:
	@if [[ -z "$(SELECTOR)" ]]; then \
		echo "Usage: make package-one SELECTOR=<all|family|family/skill-id|skill-id>" >&2; \
		exit 1; \
	fi
	cd scripts && bash skill.sh distribute-package --dist "$(DIST_DIR)" --selector "$(SELECTOR)"

validate:
	cd scripts && bash gate.sh validate

validate-fast:
	cd scripts && bash gate.sh validate

validate-repo:
	cd scripts && bash gate.sh validate

clean:
	rm -rf dist
