import {test} from 'node:test';
import assert from 'node:assert/strict';
import {translate, setLanguage, getLanguage} from '../src/i18n.js';
import {defaults, normalize, loadSettings, saveSettings} from '../src/settings.js';
import {DEFINITIONS} from '../src/data.js';
import tutorial from '../src/tutorial-steps.json' with {type:'json'};

test('language settings migrate old saves and reject unsupported values', () => {
  assert.equal(defaults().language, 'en');
  assert.equal(normalize({version:1, quality:'eco'}).language, 'en');
  assert.equal(normalize({version:1, language:'invalid'}).language, 'en');
  let stored;
  const storage = {setItem:(_, value)=>stored=value, getItem:()=>stored};
  saveSettings({...defaults(), language:'vi'}, storage);
  assert.equal(loadSettings(false, storage).language, 'vi');
});

test('Vietnamese messages preserve numbers, names and resource requirements', () => {
  assert.equal(translate('Need 180 alloy and 90 energy more to build Foundry. Assign Harvesters to deposits.', 'vi'),
    'Cần thêm 180 hợp kim và 90 năng lượng để xây Nhà máy. Hãy cho Thợ mỏ khai thác.');
  assert.equal(translate('Upgrade Barracks to level 2 to train Medic.', 'vi'), 'Nâng Doanh trại lên cấp 2 để huấn luyện Quân y.');
  assert.equal(translate('  Start  ', 'vi'), '  Bắt đầu  ');
  assert.equal(translate('ALLOY', 'vi'), 'HỢP KIM');
  assert.equal(translate('9750', 'vi'), '9750');
  assert.equal(translate('Q / E / R / T / Y', 'vi'), 'Q / E / R / T / Y');
});

test('all unit descriptions and training steps have Vietnamese translations', () => {
  for (const definition of Object.values(DEFINITIONS)) {
    for (const key of ['name','description']) assert.notEqual(translate(definition[key], 'vi'), definition[key], definition.name+': '+key);
  }
  for (const step of tutorial) for (const field of ['title','desktop','touch']) {
    assert.notEqual(translate(step[field], 'vi'), step[field]);
  }
});

test('switching back to English and missing messages preserve source text', () => {
  setLanguage('vi'); assert.equal(translate('Start'), 'Bắt đầu');
  setLanguage('en'); assert.equal(translate('Start'), 'Start');
  setLanguage('not-a-language'); assert.equal(getLanguage(), 'en');
  assert.equal(translate('Untranslated future message.', 'vi'), 'Untranslated future message.');
});
