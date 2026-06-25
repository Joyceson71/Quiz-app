const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'supabase');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix CREATE POLICY -> DROP POLICY IF EXISTS ... ON ...; \n CREATE POLICY
  content = content.replace(/CREATE POLICY "([^"]+)" ON ([\w.]+)/g, (match, policyName, tableName) => {
    return `DROP POLICY IF EXISTS "${policyName}" ON ${tableName};\n${match}`;
  });

  // Fix CREATE INDEX -> CREATE INDEX IF NOT EXISTS
  content = content.replace(/CREATE INDEX (idx_[a-zA-Z0-9_]+) ON ([\w.]+)/g, 'CREATE INDEX IF NOT EXISTS $1 ON $2');
  content = content.replace(/CREATE UNIQUE INDEX (idx_[a-zA-Z0-9_]+) ON ([\w.]+)/g, 'CREATE UNIQUE INDEX IF NOT EXISTS $1 ON $2');

  fs.writeFileSync(filePath, content);
  console.log(`Processed ${file}`);
}
