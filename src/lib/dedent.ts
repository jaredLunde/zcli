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

  let indent = -1;

  for (let i = 0; i < numLines; i++) {
    const line = lines[i];

    if (i === 0 && !line) {
      continue;
    }

    if (indent === -1) {
      const text = line.trimStart();
      indent = line.length - text.length;
      yield text;
    } else if (indent) {
      yield line.slice(indent);
    } else {
      yield line;
    }
  }
}

const linesRegex = /\r?\n|\r/g;
