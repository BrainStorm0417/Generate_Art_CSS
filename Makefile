# for saving keystrokes

TARGET := ./css-doodle.js
TARGET_MIN := ./css-doodle.min.js
LIB := ./node_modules

all: compose minify

compose: $(LIB)
	@npm run build
	@sed -i "" $$'s/\t/  /' $(TARGET)

minify: $(TARGET)
	@npm run minify
	@node ./tools/trim
	@cp $(TARGET_MIN) docs/

$(LIB):
	@npm install

docs:
	@git subtree push --prefix docs/ origin gh-pages
.PHONY: docs
