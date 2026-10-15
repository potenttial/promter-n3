/* Datos de ejemplo para la demostración — Comedor Torre Vrick */
(function (g) {
  const C = g.Core;
  function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

  const INGREDIENTS = [
    ['arroz', 'Arroz', 'kg', 32], ['frijol', 'Frijol', 'kg', 38], ['pollo', 'Pechuga de pollo', 'kg', 135],
    ['res', 'Bistec de res', 'kg', 190], ['molida', 'Carne molida', 'kg', 150], ['pescado', 'Filete de pescado', 'kg', 150],
    ['cebolla', 'Cebolla', 'kg', 30], ['jitomate', 'Jitomate', 'kg', 32], ['serrano', 'Chile serrano', 'kg', 50],
    ['guajillo', 'Chile guajillo', 'kg', 180], ['ajo', 'Ajo', 'kg', 120], ['zanahoria', 'Zanahoria', 'kg', 22],
    ['papa', 'Papa', 'kg', 30], ['calabacita', 'Calabacita', 'kg', 32], ['nopal', 'Nopales', 'kg', 30],
    ['lechuga', 'Lechuga', 'pza', 18], ['tortilla', 'Tortilla de maíz', 'kg', 26], ['pasta', 'Pasta / fideo', 'kg', 40],
    ['crema', 'Crema', 'l', 60], ['queso', 'Queso fresco', 'kg', 140], ['aceite', 'Aceite', 'l', 45],
    ['limon', 'Limón', 'kg', 35], ['aguacate', 'Aguacate', 'kg', 70], ['huevo', 'Huevo', 'kg', 48],
    ['fruta', 'Fruta de temporada', 'kg', 30], ['azucar', 'Azúcar', 'kg', 28]
  ].map(([id, name, unit, cost]) => ({ id, name, unit, cost }));

  const R = (id, name, cat, items) => ({ id, name, cat, items: items.map(([ing, qty]) => ({ ing, qty })) });
  const RECIPES = [
    R('fideo', 'Sopa de fideo', 'Sopa', [['pasta', 40], ['jitomate', 60], ['cebolla', 15], ['ajo', 3], ['aceite', 8]]),
    R('crema-cal', 'Crema de calabaza', 'Sopa', [['calabacita', 150], ['crema', 40], ['cebolla', 20], ['aceite', 5]]),
    R('consome', 'Consomé de verduras', 'Sopa', [['zanahoria', 50], ['papa', 50], ['calabacita', 50], ['cebolla', 15], ['ajo', 3]]),
    R('pollo-verde', 'Pollo en salsa verde', 'Plato fuerte', [['pollo', 180], ['serrano', 8], ['cebolla', 20], ['ajo', 3], ['aceite', 8]]),
    R('bistec', 'Bistec a la mexicana', 'Plato fuerte', [['res', 170], ['jitomate', 60], ['cebolla', 30], ['serrano', 6], ['aceite', 8]]),
    R('albondigas', 'Albóndigas al guajillo', 'Plato fuerte', [['molida', 160], ['huevo', 15], ['jitomate', 70], ['guajillo', 4], ['arroz', 10]]),
    R('pescado', 'Filete de pescado al ajillo', 'Plato fuerte', [['pescado', 180], ['ajo', 10], ['aceite', 12], ['limon', 15]]),
    R('enchiladas', 'Enchiladas verdes', 'Plato fuerte', [['pollo', 100], ['tortilla', 90], ['crema', 30], ['queso', 30], ['serrano', 6]]),
    R('nopales', 'Nopales con huevo (veg.)', 'Plato fuerte', [['nopal', 150], ['huevo', 100], ['jitomate', 40], ['cebolla', 20]]),
    R('arroz', 'Arroz rojo', 'Guarnición', [['arroz', 70], ['jitomate', 30], ['cebolla', 10], ['aceite', 8], ['zanahoria', 15]]),
    R('frijoles', 'Frijoles de la olla', 'Guarnición', [['frijol', 60], ['cebolla', 10], ['ajo', 2]]),
    R('ensalada', 'Ensalada verde', 'Guarnición', [['lechuga', 0.15], ['jitomate', 40], ['limon', 10], ['aguacate', 30]]),
    R('agua', 'Agua fresca del día', 'Bebida', [['fruta', 80], ['azucar', 20]]),
    R('tortillas', 'Tortillas', 'Acompañamiento', [['tortilla', 80]])
  ];
  const WEEK_MENU = [
    ['fideo', 'pollo-verde', 'arroz', 'agua', 'tortillas'],
    ['consome', 'bistec', 'frijoles', 'agua', 'tortillas'],
    ['crema-cal', 'albondigas', 'arroz', 'agua', 'tortillas'],
    ['fideo', 'enchiladas', 'ensalada', 'agua'],
    ['consome', 'pescado', 'arroz', 'agua', 'tortillas']
  ];
  const PEOPLE = [
    ['Ana López', 'Administración'], ['Carlos Méndez', 'Ventas'], ['Daniela Ruiz', 'Legal'], ['Eduardo Torres', 'Operaciones'],
    ['Fernanda Castro', 'TI'], ['Gabriel Ortiz', 'Ventas'], ['Héctor Salinas', 'Dirección'], ['Isabel Navarro', 'RH'],
    ['Jorge Ramírez', 'Operaciones'], ['Karla Domínguez', 'Marketing'], ['Luis Herrera', 'TI'], ['María José Peña', 'Legal'],
    ['Nicolás Vega', 'Finanzas'], ['Olivia Guzmán', 'Administración'], ['Pablo Rivas', 'Ventas'], ['Regina Fuentes', 'Marketing'],
    ['Sergio Aguilar', 'Finanzas'], ['Tania Morales', 'RH'], ['Uriel Campos', 'Operaciones'], ['Valeria Sánchez', 'Dirección'],
    ['Ximena Paredes', 'TI'], ['Yolanda Cruz', 'Administración'], ['Alejandro Ríos', 'Ventas'], ['Beatriz Luna', 'Legal'],
    ['César Medina', 'Finanzas'], ['Diana Flores', 'Marketing']
  ];
  const TAGS = ['Sin picante', 'Vegetariano', 'Sin cebolla', 'Porción chica', 'Sin gluten'];
  const COMMENTS = ['¿Podemos tener más opciones de ensalada?', 'La salsa aparte, por favor', 'Excelente el pescado', 'Agua sin azúcar'];

  function seedCatalog(today) {
    const kv = { ingredients: INGREDIENTS, recipes: RECIPES, settings: { ...C.DEFAULT_SETTINGS } };
    const start = C.addDays(C.monday(today), -28);
    C.range(start, C.addDays(C.monday(today), 11)).filter(C.isWeekday).forEach(d => {
      kv['menu:' + d] = WEEK_MENU[C.dow(d) - 1];
    });
    return kv;
  }

  function seedDemo(today) {
    const r = rng(20261014);
    const kv = seedCatalog(today);
    const start = C.addDays(C.monday(today), -28);
    const people = PEOPLE.map(([name, area], i) => {
      const uid = 'u' + (i + 1);
      const p = { name, area, created: start, demo: true };
      kv['person:' + uid] = p;
      return { uid, prob: 0.35 + r() * 0.6, tag: r() < 0.3 ? TAGS[Math.floor(r() * TAGS.length)] : null };
    });
    const lastConfirmable = C.addDays(C.monday(today), 6);
    C.range(start, lastConfirmable).filter(C.isWeekday).forEach(d => {
      people.forEach(p => {
        const answered = d <= today ? r() < 0.97 : r() < 0.7;
        if (!answered) return;
        const si = r() < p.prob;
        const rec = { s: si ? 'si' : 'no', t: Date.now() };
        if (si) {
          if (r() < 0.04) rec.d = true;
          if (p.tag) rec.tags = [p.tag];
          if (r() < 0.03) rec.n = COMMENTS[Math.floor(r() * COMMENTS.length)];
        }
        kv[`att:${d}:${p.uid}`] = rec;
      });
    });
    // Compras: cada lunes pasado, lo necesario para la semana + 3–12 % de colchón
    const S = C.stateFromKV(kv);
    let n = 0;
    for (let mon = start; mon <= C.monday(today); mon = C.addDays(mon, 7)) {
      const days = C.weekDays(mon).filter(d => d <= today || mon === C.monday(today));
      C.needs(S, days).forEach(x => {
        const f = 1.03 + r() * 0.09;
        const qty = x.unit === 'pza' ? Math.ceil(x.qty * f) : Math.round(x.qty * f * 10) / 10;
        const ing = C.ingById(S, x.id);
        kv['purchase:p' + (++n)] = { date: mon, ing: x.id, qty, unit: x.unit, total: Math.round(qty * ing.cost), note: 'Central de Abasto' };
      });
    }
    return kv;
  }
  g.Seed = { seedDemo, seedCatalog, TAGS };
})(window);
