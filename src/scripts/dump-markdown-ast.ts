import { parse } from '../lib/threads/TranscriptMarkdownService.js';
import * as fs from 'node:fs';

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
