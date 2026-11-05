// Portable UI regression: real settings/keys, read-only geometry/state; no saved fixture or hook mutation.
export const tests = [{
  name: 'Large text wide HUD caption and board remain visible',
  viewports: ['desktop'],
  async run(t) {
    const page = t.page;
    const profiles = [['D1-size',1920,1080],['D2',1366,768],['D2-player-content',1366,720]];
    const read = () => page.evaluate(() => {
      const rect = e => { const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}; };
      const hud=document.querySelector('#hud'),label=document.querySelector('#hud .stat.score .lbl'),range=document.createRange();range.selectNodeContents(label);const text=range.getBoundingClientRect(),canvas=document.querySelector('#cv'),cr=canvas.getBoundingClientRect(),layout=window.__game.layout(),game=window.__game.getState();
      return {width:innerWidth,height:innerHeight,hud:rect(hud),caption:rect(label),captionText:{top:text.y,bottom:text.bottom},canvas:{x:cr.x,y:cr.y},layout,placed:game.placed,bigText:game.settings.bigText};
    });
    for (const [name,width,height] of profiles) {
      await page.setViewportSize({width,height}); await page.reload({waitUntil:'load'});
      await page.waitForFunction(()=>window.__game?.getState().scene==='title'&&document.fonts.status==='loaded');
      await page.locator('#sc-title [data-go="settings"]').click();
      if(await page.locator('#s-big').isChecked()) await page.locator('#s-big').click();
      await page.locator('#sc-settings [data-back]').click(); await page.locator('[data-mode="classic"]').click(); await page.waitForTimeout(180);
      const normal=await read(); t.equal(normal.hud.height,68,name+': default HUD unchanged'); t.expect(!normal.bigText,name+': actual default setting');
      await t.shot('hud-'+name+'-default');
      await page.locator('#b-pause').click();await page.locator('#sc-pause [data-go="settings"]').click();await page.locator('#s-big').click();await page.locator('#sc-settings [data-back]').click();await page.locator('#b-resume').click();await page.waitForTimeout(180);
      const large=await read(); t.expect(large.bigText,name+': real Large setting applied');
      t.expect(large.captionText.top>=0&&large.captionText.bottom<=large.height,name+': complete caption text inside viewport');
      t.expect(large.captionText.top>=large.hud.y&&large.captionText.bottom<=large.hud.bottom,name+': caption text inside HUD');
      const board=large.layout.board, boxes=[{name:'board',x:board.x,y:board.y,w:board.size,h:board.size},...large.layout.slots.map((s,i)=>({name:'tray'+i,...s}))];
      for(const b of boxes){const x=large.canvas.x+b.x,y=large.canvas.y+b.y;t.expect(y>=large.hud.bottom,name+': '+b.name+' below HUD');t.expect(x>=0&&y>=0&&x+b.w<=large.width+.5&&y+b.h<=large.height+.5,name+': '+b.name+' contained');}
      await t.shot('hud-'+name+'-large');
      await page.keyboard.press('1');for(let i=0;i<9;i++)await page.keyboard.press('ArrowUp');for(let i=0;i<9;i++)await page.keyboard.press('ArrowLeft');await page.keyboard.press('Enter');
      const placed=await read();t.equal(placed.placed,large.placed+1,name+': real key placement works after resized Large HUD');
      await t.shot('hud-'+name+'-real-placement');
      t.log(JSON.stringify({profile:name,default:normal,large,afterPlacement:placed.placed,hardware:'D1-size viewport only; realGPU unqualified',mobileQualified:false}));
    }
  }
}];
