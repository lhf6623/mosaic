/**
 * mc-form · 表单容器：宿主上的命令式接口、提交 / 重置 / 取值 / 规则四条路，
 * 规则对象的契约（required / validator / message / trigger / 异步）、两个标签之间的接线
 * （control / showError）、排布（交给 mc-grid）、令牌与 part，以及「原生 input 也被认」
 * 「禁用控件不算」「textarea 里回车不提交」这些边角。探针现搭现拆，跑法 node tests/smoke.mjs form。
 */

export default async function run({ page, visit, check }) {
  /* 表单文档页：两个标签由页里的 <l-m> 引入，顺带确认文档页起得来 */
  await visit(page, '/index.html?form=1#/packages/form/page.html');
  await page
    .waitForFunction(
      () =>
        !!customElements.get('mc-form') &&
        !!customElements.get('mc-form-item') &&
        !!customElements.get('mc-input') &&
        !!customElements.get('mc-checkbox') &&
        !!customElements.get('mc-switch'),
      { timeout: 10000 },
    )
    .catch(() => {});

  /* 搭探针：fixed + 高 z-index，不参与文档页排版 */
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'form-probe';
    host.style.cssText =
      'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:12px;width:420px;' +
      'display:flex;flex-direction:column;gap:16px';
    host.innerHTML = `
      <mc-form id="f">
        <mc-form-item id="i-user" label="用户名" name="username">
          <mc-input name="username" default-value="阿吉"></mc-input>
        </mc-form-item>
        <mc-form-item id="i-mail" label="邮箱" name="email">
          <mc-input name="email"></mc-input>
        </mc-form-item>
        <mc-form-item id="i-agree" label="同意条款">
          <mc-checkbox name="agree" value="yes">我已阅读</mc-checkbox>
        </mc-form-item>
        <mc-form-item id="i-notify" label="通知">
          <mc-checkbox name="notify" value="email" checked></mc-checkbox>
          <mc-checkbox name="notify" value="sms"></mc-checkbox>
        </mc-form-item>
        <mc-form-item id="i-bare">
          <mc-input name="bare"></mc-input>
        </mc-form-item>
        <mc-form-item id="i-star" label="星号" name="star" required>
          <mc-input default-value="有值"></mc-input>
        </mc-form-item>
        <mc-form-item id="i-native" label="原生">
          <input name="raw" value="" />
          <select name="pick">
            <option value="a" selected>a</option>
            <option value="b">b</option>
          </select>
        </mc-form-item>
        <mc-form-item id="i-buttons">
          <mc-button id="b-submit" type="submit">提交</mc-button>
          <mc-button id="b-plain" type="button">普通按钮</mc-button>
        </mc-form-item>
      </mc-form>

      <mc-form id="f-off">
        <mc-form-item label="禁用的必填" name="off" required>
          <mc-input name="off" disabled></mc-input>
        </mc-form-item>
      </mc-form>

      <mc-form id="f-grid">
        <mc-grid cols="2" gap="md">
          <mc-grid-item>
            <mc-form-item label="姓" name="last" required><mc-input></mc-input></mc-form-item>
          </mc-grid-item>
          <mc-grid-item>
            <mc-form-item label="名" name="first"><mc-input default-value="三"></mc-input></mc-form-item>
          </mc-grid-item>
          <mc-grid-item span="2">
            <mc-form-item label="地址" name="address"><mc-input></mc-input></mc-form-item>
          </mc-grid-item>
        </mc-grid>
      </mc-form>

      <mc-form id="f-trigger">
        <mc-form-item id="i-tr-a" label="写了 trigger" name="tr-a"><mc-input></mc-input></mc-form-item>
        <mc-form-item id="i-tr-b" label="没写 trigger" name="tr-b"><mc-input></mc-input></mc-form-item>
      </mc-form>

      <mc-form id="f-async">
        <mc-form-item id="i-async" label="异步" name="async"><mc-input></mc-input></mc-form-item>
      </mc-form>

      <mc-form id="f-item">
        <mc-form-item id="i-anon" label="没名字的行"><mc-input></mc-input></mc-form-item>
      </mc-form>

      <mc-form id="f-order">
        <mc-form-item id="i-order" label="顺序" name="order" required><mc-input></mc-input></mc-form-item>
      </mc-form>

      <mc-form id="f-contract">
        <mc-form-item id="i-ca" label="甲" name="a"><mc-input default-value="x"></mc-input></mc-form-item>
        <mc-form-item id="i-cb" label="乙" name="b"><mc-input></mc-input></mc-form-item>
        <mc-form-item id="i-cc" label="丙" name="c"><mc-input></mc-input></mc-form-item>
        <mc-form-item id="i-cd" label="丁" name="d"><mc-input default-value="same"></mc-input></mc-form-item>
        <mc-form-item id="i-ce" label="戊" name="e"><mc-input></mc-input></mc-form-item>
      </mc-form>

      <mc-form id="f-attr" rules='{"x":[{"required":true,"message":"属性的"}]}'>
        <mc-form-item id="i-attr-x" label="x" name="x"><mc-input></mc-input></mc-form-item>
        <mc-form-item id="i-attr-y" label="y" name="y" rules='[{"required":true,"message":"行内属性的"}]'>
          <mc-input></mc-input>
        </mc-form-item>
      </mc-form>

      <mc-form id="f-two-way" rules='{"z":[{"required":true,"message":"属性的"}]}'>
        <mc-form-item id="i-two-way" label="z" name="z"><mc-input></mc-input></mc-form-item>
      </mc-form>

      <mc-form id="f-bad-json" rules='{ 这不是 JSON'>
        <mc-form-item id="i-bad-json" label="坏的" name="bad"><mc-input></mc-input></mc-form-item>
      </mc-form>

      <mc-form id="f-required">
        <mc-form-item id="i-r-text" label="文本" name="r-text"><mc-input></mc-input></mc-form-item>
        <mc-form-item id="i-r-check" label="勾选" name="r-check"><mc-checkbox value="y"></mc-checkbox></mc-form-item>
        <mc-form-item id="i-r-switch" label="开关" name="r-switch"><mc-switch></mc-switch></mc-form-item>
        <mc-form-item id="i-r-group" label="同名组" name="r-group">
          <div class="flex items-center gap-3">
            <mc-checkbox value="a"></mc-checkbox>
            <mc-checkbox value="b"></mc-checkbox>
          </div>
        </mc-form-item>
      </mc-form>`;
    document.body.append(host);

    window.__formEvents = [];
    for (const form of host.querySelectorAll('mc-form')) {
      for (const name of ['submit', 'invalid']) {
        form.addEventListener(name, (event) =>
          window.__formEvents.push([form.id, name, JSON.parse(JSON.stringify(event.data ?? null))]),
        );
      }
    }

    /* 两个通道：属性（JSON 文本，见上面的 markup）与 property（对象，可带函数） */
    document.getElementById('f-two-way').rules = { z: { required: true, message: 'property 的' } };

    /* 规则 = 宿主上的对象数据（函数是 { validator } 的简写） */
    document.getElementById('f').rules = {
      username: { required: true, message: '用户名不能为空', trigger: 'change' },
      email: { validator: (rule, value) => (value === '' || /^[^@]+@[^@]+$/.test(value) ? '' : '邮箱格式不对') },
      agree: { required: true, message: '同意条款不能为空', trigger: 'change' },
      bare: { required: true },
    };
    document.getElementById('f-grid').rules = { last: { required: true } };
    document.getElementById('f-trigger').rules = {
      'tr-a': { required: true, trigger: 'change' },
      'tr-b': { required: true },
    };
    document.getElementById('f-async').rules = {
      async: {
        validator: async (rule, value) => {
          await new Promise((resolve) => setTimeout(resolve, 120));
          return value === 'ok' ? '' : '异步没过';
        },
      },
    };
    document.getElementById('i-anon').rules = {
      validator: (rule, value) => (value ? '' : '这一行不能为空'),
    };
    document.getElementById('i-order').rules = { validator: (rule, value) => (value ? '' : '行内') };
    document.getElementById('f-order').rules = {
      order: { validator: (rule, value) => (value ? '' : '容器') },
    };
    document.getElementById('f-contract').rules = {
      a: [{ validator: () => false, message: '用 message' }, { validator: () => '第二条不该跑' }],
      b: { validator: () => undefined },
      c: {
        validator: () => {
          throw new Error('规则炸了');
        },
      },
      d: { validator: (rule, value, form) => (value === form.getValue().a ? '' : '要与甲一致') },
      e: { message: '不该用这句', validator: () => '返回值优先' },
    };
    document.getElementById('f-required').rules = {
      'r-text': { required: true },
      'r-check': { required: true },
      'r-switch': { required: true },
      'r-group': { required: true },
    };

    /* ::part() 从页面侧真的能改到内部节点（顺带验「标签在左」那条路） */
    const style = document.createElement('style');
    style.id = 'form-part-style';
    style.textContent =
      '#i-user::part(base) { padding: 7px; flex-direction: row; }' +
      '#i-user::part(label) { letter-spacing: 3px; width: 5rem; }' +
      '#i-user::part(error) { font-weight: 700; }' +
      '#i-user .mc-label-text { color: rgb(1, 2, 3); }';
    document.head.append(style);
  });

  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('#form-probe mc-input, #form-probe mc-checkbox, #form-probe mc-switch')].every(
          (el) => !!el.shadowRoot,
        ),
      { timeout: 5000 },
    )
    .catch(() => {});

  /* ---------- 宿主元素上的命令式接口（ofa 的 proto 不外露，这四个是显式挂上去的） ---------- */
  const surface = await page.evaluate(() => {
    const form = document.getElementById('f');
    const item = document.getElementById('i-user');
    return {
      methods: ['validate', 'getValue', 'submit'].map((name) => typeof form[name]),
      removed: ['reset', 'model'].map((name) => [name, form[name] === undefined]),
      itemMethods: ['control', 'showError', 'clearError'].map((name) => typeof item[name]),
      controlIsInput: item.control()?.localName ?? null,
      labelText: item.shadowRoot.querySelector('.mc-label-text').textContent,
    };
  });
  check(
    '三个命令式接口挂在宿主元素上（proto 是组件内部用的，外面调不到）；reset / model 已按设计删掉',
    surface.methods.join(',') === 'function,function,function' &&
      surface.removed.every(([, gone]) => gone === true) &&
      surface.itemMethods.join(',') === 'function,function,function' &&
      surface.controlIsInput === 'mc-input' &&
      surface.labelText === '用户名',
    JSON.stringify(surface),
  );

  /* ---------- required 属性：星号 + 标签列占位 ---------- */
  const star = await page.evaluate(() => {
    const styled = document.getElementById('i-star');
    /* 真正"没标签、没任何规则"的行：临时造一个（探针里的 i-bare 带着按字段名配的 required，现在也该画星） */
    const plain = document.createElement('mc-form-item');
    document.body.append(plain);
    const shown = (el) => {
      const root = el.shadowRoot;
      return {
        label: getComputedStyle(root.querySelector('.mc-label')).display,
        mark: getComputedStyle(root.querySelector('.mc-required')).display,
      };
    };
    const out = { styled: shown(styled), plain: shown(plain), bareMarked: false };
    /* 探针里的 i-bare 是"按字段名配了 required"的行：现在也应该画星（容器统一算） */
    out.bareMarked = document.getElementById('i-bare').hasAttribute('data-required');
    plain.remove();
    return out;
  });
  check(
    'required 属性把星号带出来（label 空也占位）；完全没规则的行整列不显示；按字段名配的 required 同样画星',
    /* ⚠️ Chrome 报的 computed display 会把 inline / inline-flex 归一成 block / flex，只能判「不是 none」 */
    star.styled.label !== 'none' &&
      star.styled.mark !== 'none' &&
      star.plain.label === 'none' &&
      star.plain.mark === 'none' &&
      star.bareMarked === true,
    JSON.stringify(star),
  );

  /* ---------- 取值口径：单个开关问控件自己（布尔或自定义值对）、同名多个给数组、剩下给字符串 ---------- */
  const initial = await page.evaluate(() => document.getElementById('f').getValue());
  check(
    'getValue() 按 name 汇总：单个 checkbox 问控件自己（给了 value 就给 value 对）、同名多个给数组、其余给字符串',
    initial.username === '阿吉' &&
      initial.agree === false && // 单项 checkbox 只写了 value（组内身份值）→ 仍旧是布尔
      JSON.stringify(initial.notify) === '["email"]' &&
      initial.raw === '' &&
      initial.pick === 'a',
    JSON.stringify(initial),
  );
  check(
    '裸的原生 <input> / <select> 也在汇总里（容器只按 name + value / checked 读）',
    initial.raw === '' && initial.pick === 'a',
    JSON.stringify({ raw: initial.raw, pick: initial.pick }),
  );

  /* ---------- 开关类的自定义值：checked-value / unchecked-value 这一对（与组内的 value 不混用） ---------- */
  const custom = await page.evaluate(async () => {
    const form = document.createElement('mc-form');
    form.innerHTML =
      '<mc-form-item label="开关" name="flag">' +
      '<mc-switch checked-value="1" unchecked-value="0"></mc-switch></mc-form-item>' +
      '<mc-form-item label="单勾" name="one">' +
      '<mc-checkbox checked-value="yes" unchecked-value="no"></mc-checkbox></mc-form-item>' +
      '<mc-form-item label="裸勾" name="plain"><mc-checkbox></mc-checkbox></mc-form-item>' +
      '<mc-form-item label="一组（用 value 当身份值）" name="group">' +
      '<mc-checkbox value="a"></mc-checkbox><mc-checkbox value="b"></mc-checkbox></mc-form-item>' +
      '<mc-form-item label="单勾有 value 也不算自定义值" name="legacy">' +
      '<mc-checkbox value="only-group-value"></mc-checkbox></mc-form-item>';
    document.body.append(form);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const before = form.getValue();
    const [sw, one, plain, g1, , legacy] = form.querySelectorAll('mc-switch, mc-checkbox');
    sw.checked = true;
    one.checked = true;
    plain.checked = true;
    g1.checked = true;
    legacy.checked = true; // 只有 value、没写 checked-value → 仍旧是布尔
    return { before, after: form.getValue() };
  });
  check(
    '开关类的自定义值：写了 checked-value 就按「checked-value / unchecked-value」给；只写 value 的单个控件仍是布尔（同名组才用 value）',
    JSON.stringify(custom.before) ===
      JSON.stringify({ flag: '0', one: 'no', plain: false, group: [], legacy: false }) &&
      JSON.stringify(custom.after) ===
        JSON.stringify({ flag: '1', one: 'yes', plain: true, group: ['a'], legacy: true }),
    JSON.stringify(custom),
  );

  /* ---------- 绑定通道：受控用法由各控件自己承担，容器只读控件（这里守"容器不碰数据"） ---------- */
  const bound = await page.evaluate(async () => {
    const form = document.getElementById("f");
    const input = document.getElementById("i-user").querySelector("mc-input");
    const before = { value: form.getValue().username, attr: input.getAttribute("value") };
    /* ofa 的 :value / sync:value 写的就是宿主 value 属性：容器此时读到的应该是新值（值从控件读） */
    input.setAttribute("value", "绑进来的");
    await new Promise((resolve) => setTimeout(resolve, 80));
    const after = { value: form.getValue().username, attr: input.getAttribute("value") };
    /* 还原，后面的用例接着按原来的初值断言 */
    input.value = "阿吉";
    input.removeAttribute("value");
    return { before, after };
  });
  check(
    "绑定通道：给控件的 value 属性写值，容器读到的就是新值（值只有一份，从控件读）",
    bound.before.attr === null &&
      bound.before.value === "阿吉" &&
      bound.after.attr === "绑进来的" &&
      bound.after.value === "绑进来的",
    JSON.stringify(bound),
  );

  /* ---------- clear-validate：清掉所有校验状态（事件或方法），在飞的异步结果作废 ---------- */
  const cleared = await page.evaluate(async () => {
    const form = document.getElementById("f");
    await form.submit();
    const red = [...form.querySelectorAll("mc-form-item")]
      .filter((item) => item.querySelector("[invalid]"))
      .map(
        (item) =>
          item.getAttribute("name") ||
          item.querySelector("[name]")?.getAttribute("name") ||
          "",
      )
      .sort();
    /* ① 从表单内部派发（冒泡上来） */
    form.querySelector("mc-button").dispatchEvent(
      new CustomEvent("clear-validate", { bubbles: true, composed: true }),
    );
    const afterBubble = [...form.querySelectorAll("mc-form-item")].filter((item) =>
      item.querySelector("[invalid]"),
    ).length;
    /* ⚠️ 文案是 data 渲染出来的（{{error}}），ofa 的 DOM 更新落在下一拍 —— 要等一拍再读 */
    await new Promise((resolve) => setTimeout(resolve, 60));
    const texts = [...form.querySelectorAll("mc-form-item")]
      .map((item) => item.shadowRoot.querySelector(".mc-error").textContent.trim())
      .join("");
    /* ② 先标红，再派发一次，紧接着让异步规则晚回 */
    await form.submit();
    form.dispatchEvent(new CustomEvent("clear-validate"));
    await new Promise((resolve) => setTimeout(resolve, 120));
    const afterMethod = form.querySelectorAll("[invalid]").length;
    return { red, afterBubble, texts, afterMethod, hasMethod: typeof form.clearValidate };
  });
  check(
    "clear-validate：往容器（或容器内部）派发就收起全部错误；不内置 reset 之后，这就是「清校验状态」的入口",
    JSON.stringify(cleared.red) === JSON.stringify(["agree", "bare"]) &&
      cleared.afterBubble === 0 &&
      cleared.texts === "" &&
      cleared.hasMethod === "function" &&
      cleared.afterMethod === 0,
    JSON.stringify(cleared),
  );

  /* ---------- 清完之后，在飞的异步校验晚回不能又把状态标红 ---------- */
  const stale = await page.evaluate(async () => {
    const form = document.createElement("mc-form");
    form.innerHTML = '<mc-form-item label="慢" name="slow"><mc-input></mc-input></mc-form-item>';
    document.body.append(form);
    await new Promise((resolve) => setTimeout(resolve, 250));
    form.rules = {
      slow: [
        {
          validator: async () => {
            await new Promise((resolve) => setTimeout(resolve, 400));
            return "晚回的失败";
          },
        },
      ],
    };
    form.validate(); // 不 await：让它挂在半路
    form.clearValidate();
    await new Promise((resolve) => setTimeout(resolve, 700));
    const item = form.querySelector("mc-form-item");
    const out = {
      invalid: !!item.querySelector("[invalid]"),
      text: item.shadowRoot.querySelector(".mc-error").textContent.trim(),
    };
    form.remove();
    return out;
  });
  check(
    "clearValidate() 会把在飞的异步校验一并作废：晚回的结果不再标红（不然清完又红，看着像没生效）",
    stale.invalid === false && stale.text === "",
    JSON.stringify(stale),
  );

  /* ---------- 换数据只推值、不动校验状态；要清就 clearValidate() ---------- */
  const swapState = await page.evaluate(async () => {
    const form = document.createElement("mc-form");
    form.innerHTML =
      '<mc-form-item label="x" name="x" rules=\'[{"required":true,"message":"x 必填"}]\'>' +
      '<mc-input></mc-input></mc-form-item>';
    document.body.append(form);
    await new Promise((resolve) => setTimeout(resolve, 250));
    await form.submit();
    const red = !!form.querySelector("[invalid]");
    /* 模拟"换一份数据"：绑定把新值推给控件（写的就是 value 属性） */
    form.querySelector("mc-input").setAttribute("value", "张三");
    await new Promise((resolve) => setTimeout(resolve, 150));
    const stillRed = !!form.querySelector("[invalid]");
    form.clearValidate();
    await new Promise((resolve) => setTimeout(resolve, 60)); // 渲染在下一拍（同上一处）
    const item = form.querySelector("mc-form-item");
    const cleared = {
      invalid: !!form.querySelector("[invalid]"),
      text: item.shadowRoot.querySelector(".mc-error").textContent.trim(),
    };
    form.remove();
    return { red, stillRed, cleared };
  });
  check(
    "换一份数据只推值、不动校验状态（容器不监听你的数据）；想一起收起就 clearValidate()",
    swapState.red === true &&
      swapState.stillRed === true &&
      swapState.cleared.invalid === false &&
      swapState.cleared.text === "",
    JSON.stringify(swapState),
  );

  /* ---------- 单字段清校验：给字段名只清那一个；事件用 detail.fields；在飞的只作废这几个 ---------- */
  const scoped = await page.evaluate(async () => {
    const form = document.createElement("mc-form");
    form.innerHTML =
      '<mc-form-item label="a" name="a" rules=\'[{"required":true,"message":"a 必填"}]\'>' +
      '<mc-input></mc-input></mc-form-item>' +
      '<mc-form-item label="b" name="b" rules=\'[{"required":true,"message":"b 必填"}]\'>' +
      '<mc-input></mc-input></mc-form-item>' +
      '<mc-form-item label="n" name="user.name" rules=\'[{"required":true,"message":"名字必填"}]\'>' +
      '<mc-input></mc-input></mc-form-item>';
    document.body.append(form);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const red = () =>
      [...form.querySelectorAll("mc-form-item")].map((item) => ({
        name: item.getAttribute("name"),
        red: !!item.querySelector("[invalid]"),
      }));
    await form.submit();
    const all = red();
    /* ① 字符串：只清 b */
    form.clearValidate("b");
    const oneByName = red();
    /* ② 事件 + detail.fields：数组，且支持 . 路径名 */
    form.dispatchEvent(
      new CustomEvent("clear-validate", { detail: { fields: ["a", "user.name"] }, bubbles: true }),
    );
    const byDetail = red();
    form.remove();
    return { all, oneByName, byDetail };
  });
  check(
    "单字段清校验：clearValidate(名字) 只清那一个，事件带 detail.fields 可以清一个或几个（. 路径名也认）",
    scoped.all.every((row) => row.red) &&
      JSON.stringify(scoped.oneByName.map((row) => row.red)) === JSON.stringify([true, false, true]) &&
      scoped.byDetail.every((row) => row.red === false),
    JSON.stringify(scoped),
  );

  /* ---------- 按字段清：在飞的那一个作废，别的照常落状态 ---------- */
  const scopedFlying = await page.evaluate(async () => {
    const form = document.createElement("mc-form");
    form.innerHTML =
      '<mc-form-item label="一" name="one"><mc-input></mc-input></mc-form-item>' +
      '<mc-form-item label="二" name="two"><mc-input></mc-input></mc-form-item>';
    document.body.append(form);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const slow = (label) => ({
      validator: async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return label + " 失败";
      },
    });
    form.rules = { one: [slow("one")], two: [slow("two")] };
    form.validate(); // 不 await：两行都挂在半路
    form.clearValidate("one");
    await new Promise((resolve) => setTimeout(resolve, 600));
    const out = [...form.querySelectorAll("mc-form-item")].map((item) => ({
      name: item.getAttribute("name"),
      red: !!item.querySelector("[invalid]"),
    }));
    form.remove();
    return out;
  });
  check(
    "按字段清只作废那一个：被清的晚回不标红，没被清的照常落状态（不会顺手把整轮都吞掉）",
    scopedFlying[0].red === false && scopedFlying[1].red === true,
    JSON.stringify(scopedFlying),
  );

  /* ---------- 预留错误位：有规则的行高度恒定（报错 / 收起都不跳），没规则的行不占位 ---------- */
  const reserved = await page.evaluate(async () => {
    const form = document.createElement("mc-form");
    form.innerHTML =
      '<mc-form-item id="r-a" label="有规则" rules=\'[{"required":true,"message":"a 必填"}]\'>' +
      '<mc-input></mc-input></mc-form-item>' +
      '<mc-form-item id="r-b" label="按字段名" name="b"><mc-input></mc-input></mc-form-item>' +
      '<mc-form-item id="r-c" label="没规则"><mc-input></mc-input></mc-form-item>';
    document.body.append(form);
    await new Promise((resolve) => setTimeout(resolve, 250));
    /* 容器的 property 通道：要在第一次报错之前就被看见 */
    form.rules = { b: [{ required: true, message: "b 必填" }] };
    const measure = () => {
      const row = (id) => document.getElementById(id);
      const slot = (id) => row(id).shadowRoot.querySelector(".mc-error");
      return {
        heights: [row("r-a"), row("r-b"), row("r-c")].map((el) => el.offsetHeight),
        form: form.offsetHeight,

        slotH: [slot("r-a"), slot("r-b"), slot("r-c")].map((el) =>
          Math.round(el.getBoundingClientRect().height),
        ),
        /* 控件与错误容器之间不留空隙：那点空隙由容器自己撑 —— 否则没文案时就是白多一段 */
        controlToSlot: ["r-a", "r-b", "r-c"].map((id) =>
          Math.round(
            slot(id).getBoundingClientRect().top -
              row(id).querySelector("mc-input").getBoundingClientRect().bottom,
          ),
        ),
      };
    };
    const before = measure();
    await form.submit();
    const red = measure();
    form.clearValidate();
    const cleared = measure();
    form.remove();
    return { before, red, cleared };
  });
  check(
    "预留错误位：每一行都常驻一行高度（兼作行间距），报错 / 收起 / 清校验都不改变行高与整表高度",
    JSON.stringify(reserved.before.heights) === JSON.stringify(reserved.red.heights) &&
      JSON.stringify(reserved.red.heights) === JSON.stringify(reserved.cleared.heights) &&
      reserved.before.form === reserved.red.form &&
      reserved.red.form === reserved.cleared.form &&
      reserved.before.heights.every((h) => h === reserved.before.heights[0]) &&
      reserved.before.slotH.every((h) => h === reserved.before.slotH[0]) &&
      reserved.before.slotH[0] > 0 &&
      reserved.before.controlToSlot.every((gap) => gap === 0) &&
      reserved.red.controlToSlot.every((gap) => gap === 0),
    JSON.stringify(reserved),
  );

  /* ---------- 星号：required 属性 与 行内 rules 里的 required: true 都亮 ---------- */
  const starSlot = await page.evaluate(async () => {
    const form = document.createElement("mc-form");
    form.innerHTML =
      '<mc-form-item id="s-attr" label="甲" required><mc-input></mc-input></mc-form-item>' +
      '<mc-form-item id="s-rules" label="乙" rules=\'[{"required":true,"message":"乙必填"}]\'>' +
      '<mc-input></mc-input></mc-form-item>' +
      '<mc-form-item id="s-validator" label="丙" rules=\'[{"validator":()=>""}]\'>' +
      '<mc-input></mc-input></mc-form-item>' +
      '<mc-form-item id="s-none" label="丁"><mc-input></mc-input></mc-form-item>';
    document.body.append(form);
    await new Promise((resolve) => setTimeout(resolve, 250));
    /* property 通道：item.rules = { required: true } */
    document.getElementById("s-none").rules = { required: true };
    await new Promise((resolve) => setTimeout(resolve, 200));
    const read = (id) => {
      const item = document.getElementById(id);
      const starSlot = item.shadowRoot.querySelector(".mc-required");
      return {
        marked: item.hasAttribute("data-required"),
        display: getComputedStyle(starSlot).display,
      };
    };
    const out = {
      attr: read("s-attr"),
      rules: read("s-rules"),
      validator: read("s-validator"),
      none: read("s-none"),
    };
    form.remove();
    return out;
  });
  check(
    "必填星号：`required` 属性、行内 rules 里的 { required: true }、item.rules property 三种都亮；只有 validator 的规则不亮",
    /* 星号是 flex 子项，computed display 会被 blockify：只断言"不是 none" */
    starSlot.attr.display !== "none" &&
      starSlot.rules.display !== "none" &&
      starSlot.none.display !== "none" &&
      starSlot.attr.marked === true &&
      starSlot.rules.marked === true &&
      starSlot.none.marked === true &&
      starSlot.validator.display === "none" &&
      starSlot.validator.marked === false,
    JSON.stringify(starSlot),
  );

  /* ---------- hide-error：只留位置、不显示文案；高度不变；红框与 invalid 事件照常 ---------- */
  const hidden = await page.evaluate(async () => {
    const form = document.createElement("mc-form");
    form.setAttribute("hide-error", "");
    form.innerHTML =
      '<mc-form-item id="h-a" label="甲" rules=\'[{"required":true,"message":"甲必填"}]\'>' +
      '<mc-input></mc-input></mc-form-item>';
    document.body.append(form);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const item = document.getElementById("h-a");
    const slot = item.shadowRoot.querySelector(".mc-error");
    const read = () => ({
      form: form.offsetHeight,
      row: item.offsetHeight,
      slot: Math.round(slot.getBoundingClientRect().height),
      text: slot.textContent.trim(),
      invalid: item.querySelector("mc-input").hasAttribute("invalid"),
    });
    let fields = null;
    form.addEventListener("invalid", (event) => {
      fields = event.data.fields;
    });
    const before = read();
    await form.submit();
    const hiddenState = read();
    form.removeAttribute("hide-error");
    await new Promise((resolve) => setTimeout(resolve, 150));
    const shown = read();
    form.setAttribute("hide-error", "");
    await new Promise((resolve) => setTimeout(resolve, 150));
    const rehidden = read();
    form.remove();
    return { before, hiddenState, shown, rehidden, fields };
  });
  check(
    "hide-error：只留位置不显示文案（高度 / 行高 / 那一格都不变），红框与 invalid 事件照常；运行时加去掉立刻重画",
    hidden.before.slot > 0 &&
      hidden.hiddenState.text === "" &&
      hidden.hiddenState.invalid === true &&
      JSON.stringify(hidden.fields) === JSON.stringify([""]) &&
      hidden.hiddenState.form === hidden.before.form &&
      hidden.hiddenState.row === hidden.before.row &&
      hidden.hiddenState.slot === hidden.before.slot &&
      hidden.shown.text === "甲必填" &&
      hidden.shown.form === hidden.before.form &&
      hidden.rehidden.text === "" &&
      hidden.rehidden.form === hidden.before.form,
    JSON.stringify(hidden),
  );

  /* ---------- 提交时的全量校验：失败落 invalid + 文案，通过的不动 ---------- */
  const validated = await page.evaluate(async () => {
    const form = document.getElementById('f');
    const user = document.querySelector('mc-input[name=username]');
    const mail = document.querySelector('mc-input[name=email]');
    const agree = document.querySelector('mc-checkbox[name=agree]');
    const bare = document.querySelector('mc-input[name=bare]');
    const errorOf = (id) => {
      const root = document.getElementById(id).shadowRoot;
      return {
        attr: document.getElementById(id).hasAttribute('data-invalid'),
        text: root.querySelector('.mc-error').textContent,
        display: getComputedStyle(root.querySelector('.mc-error')).display,
      };
    };
    const ok = await form.validate();
    return {
      ok,
      userInvalid: user.hasAttribute('invalid'),
      mailInvalid: mail.hasAttribute('invalid'),
      agreeInvalid: agree.hasAttribute('invalid'),
      bareInvalid: bare.hasAttribute('invalid'),
      agree: errorOf('i-agree'),
      bare: errorOf('i-bare'),
      user: errorOf('i-user'),
      rawInvalid: document.querySelector('input[name=raw]').hasAttribute('invalid'),
    };
  });
  check(
    '提交时全量跑：validate() 返回 false，失败字段挂 invalid、行上给文案（message / 内置兜底）',
    validated.ok === false &&
      validated.userInvalid === false &&
      validated.mailInvalid === false &&
      validated.agreeInvalid === true &&
      validated.bareInvalid === true &&
      validated.agree.attr === true &&
      validated.agree.text === '同意条款不能为空' &&
      validated.agree.display === 'block' &&
      validated.bare.text === 'bare不能为空',
    JSON.stringify(validated),
  );
  check(
    '没写规则的行整个不碰（原生 input 与已填好的行都没有 invalid）',
    validated.rawInvalid === false && validated.user.attr === false && validated.mailInvalid === false,
    JSON.stringify({ rawInvalid: validated.rawInvalid, user: validated.user }),
  );

  /* ---------- 控件的危险色：invalid 真的落到边框上（等过 transition，别读到中间值） ---------- */
  await page.waitForTimeout(260);
  const danger = await page.evaluate(() => {
    const rgbOf = (s) => (s.match(/\d+(?:\.\d+)?/g) ?? []).slice(0, 3).join(',');
    const token = (name) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace(/\s+/g, ',');
    const agree = document.querySelector('mc-checkbox[name=agree]');
    return {
      boxBorder: rgbOf(getComputedStyle(agree.shadowRoot.querySelector('.mc-box')).borderTopColor),
      danger: token('--mc-color-danger'),
    };
  });
  check(
    '校验失败时控件的 invalid 落到它自己的危险色上（--mc-color-danger）',
    danger.boxBorder === danger.danger,
    JSON.stringify(danger),
  );

  /* ---------- submit()：失败发 invalid、填好发 submit ---------- */
  const badSubmit = await page.evaluate(async () => {
    const form = document.getElementById('f');
    window.__formEvents.length = 0;
    await form.submit();
    return window.__formEvents.slice();
  });
  check(
    '校验没过时 submit() 只发 invalid，fields 是失败字段',
    badSubmit.length === 1 &&
      badSubmit[0][1] === 'invalid' &&
      JSON.stringify(badSubmit[0][2].fields) === JSON.stringify(['agree', 'bare']),
    JSON.stringify(badSubmit),
  );

  /* 真实点击勾上「同意条款」：trigger: change 命中，立刻把红色与文案收掉 */
  await page.locator('#i-agree mc-checkbox').click();
  const liveCleared = await page.evaluate(() => {
    const agree = document.querySelector('mc-checkbox[name=agree]');
    return {
      checked: agree.checked,
      invalid: agree.hasAttribute('invalid'),
      text: document.getElementById('i-agree').shadowRoot.querySelector('.mc-error').textContent,
      attr: document.getElementById('i-agree').hasAttribute('data-invalid'),
    };
  });
  check(
    'trigger 命中的字段一改好就清（不用等下一次提交）：勾一下，红色与文案立刻收掉',
    liveCleared.checked === true &&
      liveCleared.invalid === false &&
      liveCleared.text === '' &&
      liveCleared.attr === false,
    JSON.stringify(liveCleared),
  );

  const goodSubmit = await page.evaluate(async () => {
    const form = document.getElementById('f');
    document.querySelector('mc-input[name=bare]').value = '填上了';
    document.querySelector('input[name=raw]').value = 'raw-value';
    window.__formEvents.length = 0;
    await form.submit();
    return window.__formEvents.slice();
  });
  check(
    '全绿时 submit() 发 submit，载荷就是 getValue() 那份对象',
    goodSubmit.length === 1 &&
      goodSubmit[0][1] === 'submit' &&
      goodSubmit[0][2].value.username === '阿吉' &&
      goodSubmit[0][2].value.agree === true &&
      goodSubmit[0][2].value.raw === 'raw-value',
    JSON.stringify(goodSubmit),
  );

  /* ---------- 规则的 validator：值为空不校验、正则不过用返回的文案 ---------- */
  const pattern = await page.evaluate(async () => {
    const form = document.getElementById('f');
    const mail = document.querySelector('mc-input[name=email]');
    const msg = () => document.getElementById('i-mail').shadowRoot.querySelector('.mc-error').textContent;
    const emptyOk = await form.validate();
    mail.value = '不是邮箱';
    const badOk = await form.validate();
    const badMsg = msg();
    mail.value = 'a@b.c';
    const goodOk = await form.validate();
    return { emptyOk, badOk, badMsg, goodOk, invalidAfter: mail.hasAttribute('invalid') };
  });
  check(
    'validator：值空着放行（要不要必填自己决定），不过就用返回的字符串，改对了就通过',
    pattern.emptyOk === true &&
      pattern.badOk === false &&
      pattern.badMsg === '邮箱格式不对' &&
      pattern.goodOk === true &&
      pattern.invalidAfter === false,
    JSON.stringify(pattern),
  );

  /* ---------- 键盘：单行输入框回车 = 提交；textarea 里是换行 ---------- */
  await page.evaluate(() => {
    window.__formEvents.length = 0;
    document.querySelector('mc-input[name=username]').shadowRoot.querySelector('input').focus();
  });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const byEnter = await page.evaluate(() => window.__formEvents.slice());
  check(
    '单行输入框里按 Enter 就是提交（走的是 submit() 那条路）',
    byEnter.length === 1 && byEnter[0][1] === 'submit',
    JSON.stringify(byEnter),
  );

  await page.evaluate(async () => {
    const form = document.getElementById('f');
    const item = document.createElement('mc-form-item');
    item.id = 'i-memo';
    item.setAttribute('label', '备注');
    item.innerHTML = '<mc-textarea name="memo"></mc-textarea>';
    form.append(item);
    await new Promise((resolve) => setTimeout(resolve, 300));
    window.__formEvents.length = 0;
    form.querySelector('mc-textarea').shadowRoot.querySelector('textarea').focus();
  });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const byTextarea = await page.evaluate(() => ({
    events: window.__formEvents.length,
    value: document.getElementById('f').querySelector('mc-textarea').value,
  }));
  check(
    'textarea 里回车是换行、不提交（单行输入框才是提交）',
    byTextarea.events === 0 && byTextarea.value === '\n',
    JSON.stringify(byTextarea),
  );

  /* ---------- 按钮：只有 type=submit 才走提交 ---------- */
  await page.evaluate(() => {
    window.__formEvents.length = 0;
    document.querySelector('mc-input[name=username]').value = '改过的';
  });
  await page.locator('#b-submit').click();
  await page.waitForTimeout(200);
  const byButton = await page.evaluate(() => window.__formEvents.slice());
  check(
    '点 type="submit" 的 mc-button 也走提交（click 自带 composed，穿得出按钮自己的 shadow）',
    byButton.length === 1 && byButton[0][1] === 'submit',
    JSON.stringify(byButton),
  );

  /* 容器不认 type="reset"（也不认别的）：不内置重置，值不会被悄悄改回去 */
  await page.locator('#b-plain').click();
  await page.waitForTimeout(200);
  const byPlain = await page.evaluate(() => ({
    last: window.__formEvents.slice(-1)[0],
    count: window.__formEvents.filter((e) => e[0] === 'f').length,
    username: document.getElementById('f').getValue().username,
  }));
  check(
    '只有 type="submit" 的按钮走提交：普通按钮点了不发任何事件、值也不动（容器不内置重置）',
    byPlain.count === 1 && byPlain.last[1] === 'submit' && byPlain.username === '改过的',
    JSON.stringify(byPlain),
  );

  /* ---------- trigger：写了才在平时提前报，不写就只在提交时报 ---------- */
  await page.evaluate(() => {
    /* name 写在 item 上，控件本身没有 name —— 从行里找那个控件，再补一条 change */
    const fire = (itemId) => {
      const el = document.getElementById(itemId).querySelector('mc-input');
      el.value = '';
      el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    };
    fire('i-tr-a');
    fire('i-tr-b');
  });
  await page.waitForTimeout(150);
  const trigger = await page.evaluate(() => {
    const text = (id) => document.getElementById(id).shadowRoot.querySelector('.mc-error').textContent;
    return { a: text('i-tr-a'), b: text('i-tr-b') };
  });
  check(
    'trigger: change 的字段平时就报（没提交过也一样）；没写 trigger 的字段提交前一个字都不说',
    trigger.a === '写了 trigger不能为空' && trigger.b === '',
    JSON.stringify(trigger),
  );

  /* ---------- 异步 validator：validate() / submit() 都是异步的 ---------- */
  const asyncRule = await page.evaluate(async () => {
    const form = document.getElementById('f-async');
    const input = form.querySelector('mc-input');
    const before = await form.validate();
    const text = document.getElementById('i-async').shadowRoot.querySelector('.mc-error').textContent;
    input.value = 'ok';
    const after = await form.validate();
    return { before, text, after };
  });
  check(
    'async validator：validate() 等得到结果（Promise），改对了就通过',
    asyncRule.before === false && asyncRule.text === '异步没过' && asyncRule.after === true,
    JSON.stringify(asyncRule),
  );

  /* ---------- item.rules：绑在这一行上，连 name 都不用写 ---------- */
  const itemRules = await page.evaluate(async () => {
    const form = document.getElementById('f-item');
    const events = [];
    form.addEventListener('invalid', (event) => events.push(event.data.fields));
    const ok = await form.validate();
    const text = document.getElementById('i-anon').shadowRoot.querySelector('.mc-error').textContent;
    /* fields 只有 submit() 才发（validate 不发事件） */
    await form.submit();
    return {
      ok,
      text,
      value: form.getValue(),
      fields: events[0],
      invalid: form.querySelector('mc-input').hasAttribute('invalid'),
    };
  });
  check(
    'item.rules 绑位置：没有 name 的行照样跑，value 取这一行控件；invalid 的 fields 里是空串',
    itemRules.ok === false &&
      itemRules.text === '这一行不能为空' &&
      itemRules.invalid === true &&
      JSON.stringify(itemRules.value) === '{}' &&
      JSON.stringify(itemRules.fields) === '[""]',
    JSON.stringify(itemRules),
  );

  /* ---------- 一个字段的规则表：required 属性 → 行内 rules → form.rules ---------- */
  const order = await page.evaluate(async () => {
    const form = document.getElementById('f-order');
    const item = document.getElementById('i-order');
    const input = item.querySelector('mc-input');
    const text = () => item.shadowRoot.querySelector('.mc-error').textContent;
    await form.validate();
    const byAttr = text();
    item.removeAttribute('required');
    await form.validate();
    const byItem = text();
    item.rules = null;
    await form.validate();
    const byForm = text();
    input.value = 'x';
    return { byAttr, byItem, byForm, ok: await form.validate() };
  });
  check(
    '规则表按 required 属性 → 行内 rules → form.rules 的顺序拼，第一条失败胜出',
    order.byAttr === '顺序不能为空' && order.byItem === '行内' && order.byForm === '容器' && order.ok === true,
    JSON.stringify(order),
  );

  /* ---------- 规则对象里 validator 的返回契约 ---------- */
  const contract = await page.evaluate(async () => {
    const form = document.getElementById('f-contract');
    const msg = (id) => document.getElementById(id).shadowRoot.querySelector('.mc-error').textContent;
    const ok = await form.validate();
    return {
      ok,
      a: msg('i-ca'),
      b: msg('i-cb'),
      c: msg('i-cc'),
      d: msg('i-cd'),
      e: msg('i-ce'),
      aInvalid: document.getElementById('i-ca').querySelector('mc-input').hasAttribute('invalid'),
      bInvalid: document.getElementById('i-cb').querySelector('mc-input').hasAttribute('invalid'),
    };
  });
  check(
    'validator 返回什么都认：false 用 message、undefined 算过、抛异常用 error.message、非空字符串优先于 message',
    contract.ok === false &&
      contract.a === '用 message' &&
      contract.b === '' &&
      contract.c === '规则炸了' &&
      contract.d === '要与甲一致' &&
      contract.e === '返回值优先' &&
      contract.aInvalid === true &&
      contract.bInvalid === false,
    JSON.stringify(contract),
  );
  check(
    '同一字段多条规则：第一条失败就收工，后面的不再跑（返回 true / undefined 的那些放行）',
    contract.a === '用 message' && contract.b === '',
    JSON.stringify(contract),
  );

  /* ---------- required 的三种空口径 ---------- */
  const required = await page.evaluate(async () => {
    const form = document.getElementById('f-required');
    const msg = (id) => document.getElementById(id).shadowRoot.querySelector('.mc-error').textContent;
    const before = await form.validate();
    const texts = { text: msg('i-r-text'), check: msg('i-r-check'), switch: msg('i-r-switch'), group: msg('i-r-group') };
    /* 补上：文本填值、勾上、开关打开、同名组选一个 */
    form.querySelector('mc-input').value = 'x';
    form.querySelector('mc-checkbox').checked = true;
    form.querySelector('mc-switch').checked = true;
    form.querySelectorAll('mc-checkbox')[1].checked = true;
    const after = await form.validate();
    return { before, texts, after };
  });
  check(
    'required 的空值口径：文本 trim 后为空 / 开关 false / 同名组空数组都算空；补上就通过',
    required.before === false &&
      required.texts.text === '文本不能为空' &&
      required.texts.check === '勾选不能为空' &&
      required.texts.switch === '开关不能为空' &&
      required.texts.group === '同名组不能为空' &&
      required.after === true,
    JSON.stringify(required),
  );

  /* ---------- 禁用控件：不进值、不参与校验 ---------- */
  const disabled = await page.evaluate(async () => {
    const form = document.getElementById('f-off');
    return {
      value: form.getValue(),
      ok: await form.validate(),
      invalid: form.querySelector('mc-input[name=off]').hasAttribute('invalid'),
    };
  });
  check(
    '禁用控件不算值、也不参与校验（同原生 FormData）',
    JSON.stringify(disabled.value) === '{}' && disabled.ok === true && disabled.invalid === false,
    JSON.stringify(disabled),
  );

  /* ---------- rules 的属性通道：JSON 文本直接写在标签上 ---------- */
  const attrChannel = await page.evaluate(async () => {
    const form = document.getElementById('f-attr');
    const x = document.getElementById('i-attr-x');
    const y = document.getElementById('i-attr-y');
    const ok = await form.validate();
    return {
      ok,
      x: x.shadowRoot.querySelector('.mc-error').textContent,
      y: y.shadowRoot.querySelector('.mc-error').textContent,
      xInvalid: x.querySelector('mc-input').hasAttribute('invalid'),
    };
  });
  check(
    'rules 属性（JSON 文本）：容器按字段名收、行上按位置收，声明式规则一条 JS 都不用写',
    attrChannel.ok === false &&
      attrChannel.x === '属性的' &&
      attrChannel.y === '行内属性的' &&
      attrChannel.xInvalid === true,
    JSON.stringify(attrChannel),
  );

  const twoWay = await page.evaluate(async () => {
    const form = document.getElementById('f-two-way');
    const text = () => document.getElementById('i-two-way').shadowRoot.querySelector('.mc-error').textContent;
    await form.validate();
    const both = text();
    form.removeAttribute('rules');
    await form.validate();
    return { both, propOnly: text() };
  });
  check(
    '同一个字段两个通道都写：属性在前、property 在后（第一条失败胜出；属性撤掉就轮到 property）',
    twoWay.both === '属性的' && twoWay.propOnly === 'property 的',
    JSON.stringify(twoWay),
  );

  const badJson = await page.evaluate(async () => {
    const form = document.getElementById('f-bad-json');
    return {
      ok: await form.validate(),
      invalid: form.querySelector('mc-input').hasAttribute('invalid'),
    };
  });
  check(
    'rules 属性写坏了（不是 JSON）：只 warn 不炸，这一行按「没有规则」走',
    badJson.ok === true && badJson.invalid === false,
    JSON.stringify(badJson),
  );

  /* ---------- 排布不内置：套 mc-grid 排多列，取值与校验照常 ---------- */
  const grid = await page.evaluate(async () => {
    const form = document.getElementById('f-grid');
    const gridEl = form.querySelector('mc-grid');
    const items = form.querySelectorAll('mc-grid-item');
    const itemDir = (el) => getComputedStyle(el.shadowRoot.querySelector('.mc-base')).flexDirection;
    return {
      tracks: getComputedStyle(gridEl).gridTemplateColumns.split(' ').length,
      /* grid-column: span N 是简写 → start 拿得到 span N，end 是 auto */
      span: getComputedStyle(items[2]).gridColumnStart,
      value: form.getValue(),
      ok: await form.validate(),
      invalid: items[0].querySelector('mc-input').hasAttribute('invalid'),
      rowDir: itemDir(document.getElementById('i-user')),
      plainDir: itemDir(items[1].querySelector('mc-form-item')),
    };
  });
  check(
    '排布交给栅格：cols=2 两列、span=2 跨两列，格子里的表单取值 / 校验 / invalid 照常',
    grid.tracks === 2 &&
      grid.span === 'span 2' &&
      grid.value.first === '三' &&
      grid.value.last === '' &&
      grid.ok === false &&
      grid.invalid === true,
    JSON.stringify(grid),
  );
  check(
    '一行默认竖排（容器不给排布维度）；要标签在左是内部样式那条路（::part(base) 转 row，只影响那一行）',
    grid.plainDir === 'column' && grid.rowDir === 'row',
    JSON.stringify({ plainDir: grid.plainDir, rowDir: grid.rowDir }),
  );

  /* ---------- 行距 = 每行底部的错误位高度（容器不再单独给行间距） ---------- */
  const tokens = await page.evaluate(() => {
    const form = document.getElementById('f');
    const item = document.getElementById('i-user');
    const base = form.shadowRoot.querySelector('.mc-base');
    const before = {
      rowGap: getComputedStyle(base).rowGap,
      itemH: item.offsetHeight,
    };
    form.style.setProperty('--mc-form-item-error-h', '30px');
    const after = { itemH: item.offsetHeight };
    form.style.removeProperty('--mc-form-item-error-h');
    return { before, after };
  });
  check(
    '行距由每行的错误位撑起来（容器没有 row-gap）：把 --mc-form-item-error-h 调大，行高跟着长',
    tokens.before.rowGap === 'normal' && tokens.after.itemH === tokens.before.itemH + 14,
    JSON.stringify(tokens),
  );

  /* ---------- part：三个都真的改得动 ---------- */
  const parts = await page.evaluate(() => {
    const item = document.getElementById('i-user');
    const base = getComputedStyle(item.shadowRoot.querySelector('[part="base"]'));
    const label = getComputedStyle(item.shadowRoot.querySelector('[part="label"]'));
    const error = getComputedStyle(item.shadowRoot.querySelector('[part="error"]'));
    return {
      padding: base.paddingTop,
      spacing: label.letterSpacing,
      weight: error.fontWeight,
      names: ['base', 'label', 'error'].map(
        (name) => !!item.shadowRoot.querySelector('[part="' + name + '"]'),
      ),
    };
  });
  check(
    'part="base" / "label" / "error" 都在，且页面侧 ::part() 真的改到了内部节点',
    parts.names.every(Boolean) &&
      parts.padding === '7px' &&
      parts.spacing === '3px' &&
      parts.weight === '700',
    JSON.stringify(parts),
  );

  /* ---------- 后加进来的控件：slotchange 补记初始值，reset 回得来 ---------- */
  const late = await page.evaluate(async () => {
    const form = document.createElement('mc-form');
    document.body.append(form);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const item = document.createElement('mc-form-item');
    item.innerHTML = '<mc-input name="late" default-value="late-value"></mc-input>';
    form.append(item);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const joined = form.getValue();
    form.querySelector('mc-input').value = 'changed';
    const dirty = form.getValue();
    return { joined, dirty, ok: await form.validate() };
  });
  check(
    '挂载后加进来的控件也进取值表（默认值来自它自己的 default-value），改了就跟着变',
    late.joined.late === 'late-value' && late.dirty.late === 'changed' && late.ok === true,
    JSON.stringify(late),
  );

  /* ---------- 原生 radio + 控件包了一层的行 ---------- */
  const radio = await page.evaluate(async () => {
    const form = document.createElement('mc-form');
    form.innerHTML =
      '<mc-form-item label="原生单选"><span>' +
      '<input type="radio" name="r" value="a" checked />' +
      '<input type="radio" name="r" value="b" />' +
      '</span></mc-form-item>';
    document.body.append(form);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const before = form.getValue();
    const [first, second] = form.querySelectorAll('input');
    first.checked = false;
    second.checked = true;
    const picked = form.getValue();
    return { before, picked };
  });
  check(
    '原生 radio 成组时只算选中的那个（也盖住「控件包了一层」那条路）',
    JSON.stringify(radio.before) === '{"r":"a"}' && JSON.stringify(radio.picked) === '{"r":"b"}',
    JSON.stringify(radio),
  );

  /* ---------- 字段名写在 mc-form-item 上（基本用法那种写法）：键要取 item 的 name ---------- */
  const named = await page.evaluate(async () => {
    const form = document.createElement('mc-form');
    form.innerHTML =
      '<mc-form-item label="用户名" name="username"><mc-input></mc-input></mc-form-item>' +
      '<mc-form-item label="邮箱" name="email"><mc-input></mc-input></mc-form-item>' +
      '<mc-form-item label="订阅" name="digest"><mc-checkbox value="weekly"></mc-checkbox></mc-form-item>' +
      '<mc-form-item label="通知" name="notify"><mc-switch></mc-switch></mc-form-item>' +
      '<mc-form-item label="套餐" name="plan"><mc-radio-group default-value="b">' +
      '<mc-radio value="a">月付</mc-radio><mc-radio value="b">年付</mc-radio>' +
      '</mc-radio-group></mc-form-item>';
    document.body.append(form);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const inputs = form.querySelectorAll('mc-input');
    inputs[0].value = 'test';
    inputs[1].value = 'qq@qq.com';
    form.querySelector('mc-checkbox').checked = true;
    form.querySelector('mc-switch').checked = true;
    return form.getValue();
  });
  check(
    '字段名只写在 mc-form-item 上时键就是 item 的 name（不是 ""）；ofa 写的幽灵 name="" 不算字段名',
    JSON.stringify(named) ===
      JSON.stringify({
        username: 'test',
        email: 'qq@qq.com',
        digest: true,
        notify: true,
        plan: 'b',
      }),
    JSON.stringify(named),
  );

  /* ---------- 字段名里的点是路径 ---------- */
  const nested = await page.evaluate(async () => {
    const form = document.createElement('mc-form');
    form.innerHTML =
      '<mc-form-item label="a" name="data.name"><mc-input default-value="张三"></mc-input></mc-form-item>' +
      '<mc-form-item label="b" name="list.0.name"><mc-input default-value="李四"></mc-input></mc-form-item>' +
      '<mc-form-item label="c" name="list.1.tags">' +
      '<mc-checkbox value="x" checked></mc-checkbox><mc-checkbox value="y" checked></mc-checkbox>' +
      '</mc-form-item>' +
      '<mc-form-item label="d" name="a..b"><mc-input default-value="flat"></mc-input></mc-form-item>' +
      '<mc-form-item label="e" name="__proto__.polluted"><mc-input default-value="no"></mc-input></mc-form-item>';
    document.body.append(form);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const value = form.getValue();
    return {
      value,
      json: JSON.stringify(value),
      safe: {}.polluted === undefined && Object.prototype.polluted === undefined,
    };
  });
  check(
    'name 里的点是路径：data.name → 嵌套对象、list.0.name / list.1.tags → 数组下标（同名多个在末端合成数组）',
    nested.value.data?.name === '张三' &&
      nested.value.list?.[0]?.name === '李四' &&
      JSON.stringify(nested.value.list?.[1]?.tags) === '["x","y"]',
    nested.json,
  );
  check(
    '空段（a..b）与 __proto__ 这类段名整条退回字面键，也不碰原型',
    nested.value['a..b'] === 'flat' &&
      nested.value['__proto__.polluted'] === 'no' &&
      nested.safe === true,
    nested.json,
  );

  /* ---------- 收摊 ---------- */
  await page.evaluate(() => {
    document.getElementById('form-probe')?.remove();
    document.getElementById('form-part-style')?.remove();
  });
}
