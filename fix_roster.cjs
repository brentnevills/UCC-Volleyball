const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `                <div className="flex items-center space-x-2 sm:space-x-3 bg-white p-1 sm:p-2 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
                  <Save
                    size={16}
                    className="text-[#0033A0] ml-2 sm:w-5 sm:h-5"
                  />
                  <input
                    placeholder="Save Roster As..."
                    value={rosterPresetName}
                    onChange={(e) => setRosterPresetName(e.target.value)}
                    className="flex-1 bg-transparent border-none font-bold focus:ring-0 outline-none text-slate-700 placeholder-slate-400 text-xs sm:text-base"
                  />
                  <button
                    onClick={saveRosterAsPreset}
                    className="bg-[#0033A0] text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold hover:bg-blue-800 transition-colors shadow-sm text-xs sm:text-sm"
                  >
                    SAVE
                  </button>
                </div>`;

const replacement = `                <div className="flex items-center space-x-2 sm:space-x-3 bg-white p-1 sm:p-2 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
                  <Save
                    size={16}
                    className="text-[#0033A0] ml-2 sm:w-5 sm:h-5"
                  />
                  <input
                    placeholder="Preset Name..."
                    value={rosterPresetName}
                    onChange={(e) => setRosterPresetName(e.target.value)}
                    className="flex-1 bg-transparent border-none font-bold focus:ring-0 outline-none text-slate-700 placeholder-slate-400 text-xs sm:text-base min-w-[50px] w-12"
                  />
                  <div className="flex space-x-1 pr-1">
                    <button
                      onClick={() => saveRosterAsPreset()}
                      className="bg-[#0033A0] text-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold hover:bg-blue-800 transition-colors shadow-sm text-[10px] sm:text-xs tracking-wider"
                    >
                      SAVE
                    </button>
                    <button
                      onClick={() => {
                        const newName = prompt("Save Roster As:");
                        if (newName) saveRosterAsPreset(newName);
                      }}
                      className="bg-slate-200 text-slate-800 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold hover:bg-slate-300 transition-colors shadow-sm text-[10px] sm:text-xs tracking-wider whitespace-nowrap"
                    >
                      SAVE AS
                    </button>
                  </div>
                </div>`;

content = content.replaceAll(target, replacement);

fs.writeFileSync('src/App.tsx', content);
