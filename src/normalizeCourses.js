'use strict';

const TRACK_KW = {
  'Offensive Security':   ['pentest','red team','kali','metasploit','oscp','exploit','ctf','ethical hack','invasão'],
  'SOC / Blue Team':      ['soc','blue team','siem','splunk','dfir','incident response','forense','threat hunt'],
  'Cloud Security':       ['cloud security','aws security','azure security','cspm','zero trust','iam security'],
  'Cloud':                ['aws','azure','gcp','google cloud','kubernetes','k8s','terraform','cloud architect'],
  'DevOps':               ['devops','docker','ci/cd','helm','ansible','gitops','argocd','pipeline','jenkins'],
  'Application Security': ['owasp','appsec','devsecops','secure coding','sast','dast','burp suite','xss','sqli'],
  'Desenvolvimento':      ['python','javascript','typescript','react','node','java','golang','rust','backend','frontend','api rest'],
  'Data / IA':            ['machine learning','data science','ia ','inteligência artificial','nlp','llm','bigquery','sklearn'],
};

const TRACK_META = {
  'Offensive Security':   { color: '#EA1D2C', icon: 'sword' },
  'SOC / Blue Team':      { color: '#3B82F6', icon: 'shield' },
  'Cloud Security':       { color: '#0EA5E9', icon: 'cloud' },
  'Cloud':                { color: '#0284C7', icon: 'cloud' },
  'DevOps':               { color: '#FF9800', icon: 'server' },
  'Application Security': { color: '#5B4FB3', icon: 'bug' },
  'Desenvolvimento':      { color: '#4CAF50', icon: 'code' },
  'Data / IA':            { color: '#9C27B0', icon: 'terminal' },
  'Tech & InfoSec':       { color: '#607D8B', icon: 'terminal' },
};

function detectTrack(text) {
  const t = (text || '').toLowerCase();
  for (const [track, kws] of Object.entries(TRACK_KW)) {
    if (kws.some(k => t.includes(k))) return track;
  }
  return 'Tech & InfoSec';
}

function trackMeta(track) {
  return TRACK_META[track] || TRACK_META['Tech & InfoSec'];
}

module.exports = { detectTrack, trackMeta };
