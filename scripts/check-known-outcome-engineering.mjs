import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const configPath = path.join(root, 'config', 'known-outcome-engineering.v1.json');
const docPath = path.join(root, 'docs', 'ENGINEERING', 'KNOWN_OUTCOME_ENGINEERING_V1.md');
const missionDir = path.join(root, 'engineering', 'known-outcome-missions');

const novelty = ['REUSE', 'ADAPT', 'COMPOSE', 'ADAPTER', 'NOVEL', 'WORKAROUND', 'TEST_FAULT'];
const restricted = new Set(['NOVEL', 'WORKAROUND', 'TEST_FAULT']);
const stageResults = new Set(['PASS', 'KNOWN_REPAIR', 'BLOCKED_UNKNOWN', 'EXTERNAL_ACCEPTANCE_REQUIRED']);

function fail(message) {
  console.error(`KNOWN_OUTCOME_ENGINEERING_FAILED: ${message}`);
  process.exit(1);
}

function require(condition, message) {
  if (!condition) fail(message);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`cannot read ${path.relative(root, file)}: ${error}`);
  }
}

require(fs.existsSync(configPath), 'missing config/known-outcome-engineering.v1.json');
require(fs.existsSync(docPath), 'missing docs/ENGINEERING/KNOWN_OUTCOME_ENGINEERING_V1.md');

const contract = readJson(configPath);
require(contract.schema_version === 'known-outcome-engineering-v1', 'unexpected schema_version');
require(contract.project === 'memoriesmystory', 'unexpected project identity');
require(JSON.stringify(contract.novelty_classes) === JSON.stringify(novelty), 'novelty class contract drifted');
require(new Set(contract.restricted_novelty_classes || []).size === restricted.size && [...restricted].every(value => contract.restricted_novelty_classes.includes(value)), 'restricted novelty classes drifted');
require(new Set(contract.stage_results || []).size === stageResults.size && [...stageResults].every(value => contract.stage_results.includes(value)), 'stage result contract drifted');
require(contract.platform_native_first === true, 'platform_native_first must remain true');
require(contract.unknown_requires_evidence === true, 'unknown_requires_evidence must remain true');
require(contract.large_rewrite_default_authorized === false, 'large rewrites must not become default-authorized');
require(contract.live_external_actions_require_explicit_authorization === true, 'live external actions must require explicit authorization');
require(contract.no_cross_repository_product_inheritance === true, 'cross-repository product inheritance must remain prohibited');
require(contract.original_media_immutable === true, 'original media immutability must remain required');
require(contract.human_ai_truth_boundary_required === true, 'human/AI truth boundary must remain required');

const returns = new Set(contract.commercial_stop?.return_to || []);
for (const required of ['real_user_magic_moment', 'preservation_quality', 'retention']) {
  require(returns.has(required), `commercial stop must return to ${required}`);
}

let checked = 0;
if (fs.existsSync(missionDir)) {
  for (const name of fs.readdirSync(missionDir).sort()) {
    if (!name.endsWith('.json') || name.startsWith('TEMPLATE')) continue;
    const file = path.join(missionDir, name);
    const mission = readJson(file);
    for (const field of contract.required_mission_fields || []) {
      require(Object.prototype.hasOwnProperty.call(mission, field), `${path.relative(root, file)} missing ${field}`);
    }
    require(novelty.includes(mission.novelty_class), `${path.relative(root, file)} has invalid novelty_class`);
    require(contract.test_layers.includes(mission.test_layer), `${path.relative(root, file)} has invalid test_layer`);
    require(Boolean(mission.unresolved_surface), `${path.relative(root, file)} must declare unresolved_surface`);
    require(Boolean(mission.stop_condition), `${path.relative(root, file)} must declare stop_condition`);
    require(Boolean(mission.preservation_recovery_implications), `${path.relative(root, file)} must declare preservation/recovery implications`);
    if (restricted.has(mission.novelty_class)) {
      require(Boolean(mission.evidence?.length), `${path.relative(root, file)} uses ${mission.novelty_class} without evidence`);
      require(Boolean(mission.known_sources_checked), `${path.relative(root, file)} uses ${mission.novelty_class} without known-source search evidence`);
    }
    checked += 1;
  }
}

console.log(`KNOWN_OUTCOME_ENGINEERING_OK missions=${checked}`);
