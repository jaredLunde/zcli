export function dedent(str: string): string {
  if (!str) return str;
  const lines = str.trimEnd().split(linesRegex);
  if (lines.length === 1) return str;

  let text = "";
  let indent = 0;
  const lastLine = lines.length - 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (text || line.trim()) {
      if (!text) {
        text = line.trimStart();
        indent = line.length - text.length;
      } else if (indent) {
        text += line.slice(indent);
      } else {
        text += line;
      }

      if (i < lastLine) {
        text += "\n";
      }
    }
  }

  return text;
}

const linesRegex = /\r?\n|\r/g;
