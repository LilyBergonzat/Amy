import { parse } from '../lib/threads/TranscriptMarkdownService.js';
import * as fs from 'node:fs';

if (!process.argv[2] || !fs.existsSync(process.argv[2])) {
    console.log('Usage: npm run script:dump:markdown-ast <file-that-contains-markdown.txt>');
    process.exit(1);
}

const nodes = parse(fs.readFileSync(process.argv[2], { encoding: 'utf-8' }));
const types = [...new Set(nodes.map((node) => node.type))];

console.log('Node types:', types);

for (const type of types) {
    console.log(`=== Shape of type ${type} ===`);

    for (const node of nodes.filter((node) => node.type === type)) {
        console.log(node);
    }

    console.log('');
}
