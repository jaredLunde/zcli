export function* dedent(str: string): Iterable<string> {
  if (!str) {
    yield str;
    return;
  }

  const lines = str.trimEnd().split(linesRegex);
  const numLines = lines.length;

  if (numLines === 1) {
    yield str;
    return;
  }

  let indent = 0;

  for (let i = 0; i < numLines; i++) {
    let text = "";
    const line = lines[i];

    if (i === 0) {
      text = line.trimStart();
      indent = line.length - text.length;
    } else if (indent) {
      text += line.slice(indent);
    } else {
      text += line;
    }

    if (i === 0 && !line) {
      continue;
    } else {
      yield text;
    }
  }
}

const linesRegex = /\r?\n|\r/g;
