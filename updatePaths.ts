import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace publicPath variable assignment
content = content.replace(/const publicPath = \`artifacts\/\$\{appId\}\/public\/data\`;/g, 'const publicPath = `teams`;');

// Replace occurrences
content = content.replace(/\$\{publicPath\}\/settings_\$\{activeTeam\}/g, '${publicPath}/${activeTeam}/settings');
content = content.replace(/\$\{publicPath\}\/opponents_\$\{activeTeam\}/g, '${publicPath}/${activeTeam}/opponents');
content = content.replace(/\$\{publicPath\}\/matches_\$\{activeTeam\}/g, '${publicPath}/${activeTeam}/matches');
content = content.replace(/\$\{publicPath\}\/sets_\$\{activeTeam\}/g, '${publicPath}/${activeTeam}/sets');
content = content.replace(/\$\{publicPath\}\/stats_\$\{activeTeam\}/g, '${publicPath}/${activeTeam}/stats');

fs.writeFileSync('src/App.tsx', content);
console.log('App.tsx paths updated for Firebase');
