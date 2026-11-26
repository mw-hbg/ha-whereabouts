// Whereabouts – settings page: styles. Part of settings-page.js.

export const CSS = `
  whereabouts-settings { display: block; }
  .wa-set [hidden] { display: none !important; }
  .wa-set { display: flex; gap: 24px; max-width: 1180px; margin: 0 auto; padding: 16px; box-sizing: border-box;
            color: var(--primary-text-color); }
  .wa-set .toc { flex: 0 0 220px; position: sticky; top: 16px; align-self: flex-start; max-height: calc(100vh - 120px); overflow: auto; }
  .wa-set .toc .gruppe { margin: 14px 0 6px; padding: 0 12px; font-size: 12px; font-weight: 500; letter-spacing: .06em;
                         text-transform: uppercase; color: var(--secondary-text-color); }
  .wa-set .toc .gruppe:first-child { margin-top: 0; }
  .wa-set .toc a { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 10px; cursor: pointer;
                   color: var(--primary-text-color); text-decoration: none; font-size: 14px; }
  .wa-set .toc a:hover { background: var(--secondary-background-color); }
  .wa-set .toc a.aktiv { background: rgba(var(--rgb-primary-color, 3,169,244), .12); color: var(--primary-color); font-weight: 500; }
  .wa-set .toc ha-icon { --mdc-icon-size: 20px; color: var(--secondary-text-color); }
  .wa-set .toc a.aktiv ha-icon { color: var(--primary-color); }
  .wa-set .toc .schloss { margin-left: auto; --mdc-icon-size: 16px; }
  .wa-set main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
  .wa-set .sprung { display: none; }
  .wa-set .oben { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .wa-set ha-selector.farbfeld { display: block; width: 80px; }
  .wa-set .steuer input[type="color"].ein { width: 80px; }
  .wa-set .oben h1 + .kopfinfo { margin-left: -6px; }
  .wa-set .kopfhinweise[hidden] { display: none; }
  .wa-set .oben h1 { margin: 0; font-size: 24px; font-weight: 400; flex: 1 1 auto; }
  .wa-set .umschalter { display: inline-flex; border: 1px solid var(--divider-color); border-radius: 20px; overflow: hidden; }
  .wa-set .umschalter button { font: inherit; font-size: 14px; padding: 7px 14px; border: none; background: none;
                               color: var(--primary-text-color); cursor: pointer; }
  .wa-set .umschalter button.aktiv { background: var(--primary-color); color: var(--text-primary-color, #fff); }
  .wa-set .hinweis { font-size: 14px; color: var(--secondary-text-color); line-height: 1.5; margin: 0; }
  .wa-set ha-card { display: block; overflow: visible; }
  .wa-set .kat-kopf { display: flex; align-items: center; gap: 12px; padding: 16px 16px 8px; }
  .wa-set .kat-kopf.klapp { cursor: pointer; padding-bottom: 16px; }
  .wa-set .kat-kopf .symbol { --mdc-icon-size: 24px; color: var(--secondary-text-color); }
  .wa-set .kat-kopf h2 { margin: 0; font-size: 18px; font-weight: 500; flex: 1 1 auto; }
  .wa-set .kat-kopf .pfeil { transition: transform .2s; color: var(--secondary-text-color); }
  .wa-set .kat.zu .kat-kopf .pfeil { transform: rotate(-90deg); }
  .wa-set .kat.zu .kat-inhalt { display: none; }
  .wa-set .kat:not(.zu) .kat-kopf.klapp { padding-bottom: 8px; }
  .wa-set .kat-text { padding: 0 16px 8px 52px; margin: 0; font-size: 14px; color: var(--secondary-text-color); line-height: 1.5; }
  .wa-set .marke { font-size: 12px; padding: 3px 9px; border-radius: 10px; white-space: nowrap;
                   background: var(--secondary-background-color); color: var(--secondary-text-color); display: inline-flex; gap: 4px; align-items: center; }
  .wa-set .marke ha-icon { --mdc-icon-size: 14px; }
  .wa-set .knopf { font: inherit; font-size: 14px; font-weight: 500; padding: 7px 14px; border-radius: 18px; cursor: pointer;
                   border: 1px solid var(--divider-color); background: none; color: var(--primary-color);
                   display: inline-flex; align-items: center; gap: 6px; }
  .wa-set .knopf:hover:not(:disabled) { background: rgba(var(--rgb-primary-color, 3,169,244), .08); }
  .wa-set .knopf:disabled { opacity: .45; cursor: default; }
  .wa-set a.knopf { display: inline-flex; align-items: center; gap: 4px; text-decoration: none; }
  .wa-set .knopf.gefahr { color: var(--error-color, #db4437); }
  .wa-set .knopf.voll { background: var(--primary-color); color: var(--text-primary-color, #fff); border-color: var(--primary-color); }
  .wa-set .knopf ha-icon { --mdc-icon-size: 18px; }
  .wa-set .rund { width: 36px; height: 36px; padding: 0; justify-content: center; border-radius: 50%; border: none; color: var(--secondary-text-color); }
  .wa-set .zeile { display: grid; grid-template-columns: minmax(0, 1fr) minmax(180px, 320px); gap: 4px 16px; align-items: center;
                   padding: 10px 16px; border-top: 1px solid var(--divider-color); }
  .wa-set .zeile.breit { grid-template-columns: minmax(0, 1fr); }
  .wa-set .beschriftung { display: flex; align-items: center; gap: 4px; min-width: 0; font-size: 15px; }
  .wa-set .info, .wa-set .kopfinfo { flex: 0 0 auto; width: 30px; height: 30px; border: none; border-radius: 50%; background: none; cursor: pointer;
                  color: var(--secondary-text-color); display: inline-flex; align-items: center; justify-content: center; padding: 0; }
  .wa-set .info:hover, .wa-set .info[aria-expanded="true"], .wa-set .kopfinfo:hover, .wa-set .kopfinfo[aria-expanded="true"] { color: var(--primary-color); background: rgba(var(--rgb-primary-color, 3,169,244), .1); }
  .wa-set .info ha-icon, .wa-set .kopfinfo ha-icon { --mdc-icon-size: 18px; }
  .wa-set .infotext { grid-column: 1 / -1; font-size: 13px; line-height: 1.5; color: var(--secondary-text-color);
                      background: var(--secondary-background-color); border-radius: 8px; padding: 8px 12px; }
  .wa-set .infotext[hidden] { display: none; }
  .wa-set .steuer { min-width: 0; display: flex; justify-content: flex-end; }
  .wa-set .steuer > * { width: 100%; }
  .wa-set .steuer.schalter > * { width: auto; }
  .wa-set .gesperrt .steuer { opacity: .6; }
  .wa-set .verweis { grid-column: 1 / -1; justify-self: end; display: inline-flex; align-items: center; gap: 4px; font-size: 13px;
                     color: var(--primary-color); text-decoration: none; }
  .wa-set .verweis:hover { text-decoration: underline; }
  .wa-set .verweis ha-icon { --mdc-icon-size: 16px; }
  .wa-set .warnung { margin: 8px 16px; padding: 10px 12px; border-radius: 8px; font-size: 14px;
                     background: rgba(255,166,0,.14); color: var(--primary-text-color); border-left: 4px solid var(--warning-color, #ffa600); }
  .wa-set .fuss { display: flex; justify-content: flex-end; gap: 8px; padding: 8px 16px 16px; flex-wrap: wrap; }
  .wa-set .person { display: grid; grid-template-columns: auto 44px minmax(0, 1fr) auto; gap: 8px 12px; align-items: center;
                    padding: 12px 16px; border-top: 1px solid var(--divider-color); }
  .wa-set .person.aus { opacity: .55; }
  .wa-set .person .bild { width: 44px; height: 44px; border-radius: 50%; border: 3px solid var(--farbe); box-sizing: border-box;
                          background: var(--farbe) center/cover no-repeat; color: #fff; font-weight: 700; font-size: 18px;
                          display: flex; align-items: center; justify-content: center; }
  .wa-set .person .felder { display: grid; grid-template-columns: minmax(120px, 1fr) 120px minmax(160px, 1.4fr); gap: 8px; min-width: 0; }
  .wa-set .person .reihenfolge { display: flex; flex-direction: column; }
  .wa-set .person .bildzeile { display: flex; gap: 4px; align-items: center; min-width: 0; }
  .wa-set .person .bildzeile > :first-child { flex: 1 1 auto; min-width: 0; }
  .wa-set input.ein, .wa-set select.ein { font: inherit; font-size: 14px; padding: 9px 10px; width: 100%; box-sizing: border-box;
                                         border: 1px solid var(--divider-color); border-radius: 8px;
                                         background: var(--card-background-color); color: var(--primary-text-color); }
  .wa-set input[type="color"].ein { padding: 2px; height: 40px; }
  .wa-set .tabelle { width: 100%; border-collapse: collapse; font-size: 14px; }
  .wa-set .tabelle th, .wa-set .tabelle td { text-align: left; padding: 8px 10px; border-top: 1px solid var(--divider-color); vertical-align: top; }
  .wa-set .tabelle th { font-weight: 500; color: var(--secondary-text-color); }
  .wa-set .tabellenrahmen { overflow-x: auto; padding: 0 6px 8px; }
  .wa-set .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .wa-set .chip { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; padding: 4px 10px 4px 6px; border-radius: 14px;
                  border: 1px solid var(--divider-color); cursor: pointer; user-select: none; }
  .wa-set .chip input { margin: 0; }
  .wa-set .chip.an { background: rgba(var(--rgb-primary-color, 3,169,244), .12); border-color: var(--primary-color); }
  .wa-set .chip.fest { cursor: default; }
  .wa-set .ablage { margin: 8px 16px; padding: 20px; border: 2px dashed var(--divider-color); border-radius: 12px; text-align: center;
                    color: var(--secondary-text-color); cursor: pointer; }
  .wa-set .ablage.drueber { border-color: var(--primary-color); color: var(--primary-color); }
  .wa-set .ergebnis { margin: 8px 16px; font-size: 14px; line-height: 1.6; }
  .wa-set .ok { color: var(--success-color, #43a047); }
  .wa-set .schlecht { color: var(--error-color, #db4437); }
  .wa-set .klein { font-size: 12px; color: var(--secondary-text-color); }
  /* 0.7.10: group "Open tasks" */
  .wa-set .aufgaben { display: flex; flex-direction: column; gap: 10px; }
  .wa-set .aufgabe { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border: 1px solid var(--divider-color); border-radius: 10px; }
  .wa-set .aufgabe-text { font-size: 14px; line-height: 1.5; }
  .wa-set .aufgabe-aktionen { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .wa-set .aufgabe .knopf { width: auto; }
  .wa-set .aufgaben .adressauftrag:empty, .wa-set .aufgaben .job:empty, .wa-set .aufgaben .offene:empty { display: none; }
  .wa-set .aufgaben-rahmen { padding: 4px 16px 14px; }
  .wa-set .aufgaben .adressauftrag { padding: 4px 12px 10px; border: 1px solid var(--divider-color); border-radius: 10px; }
  .wa-set .dialog { position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center;
                    background: rgba(0,0,0,.45); padding: 16px; }
  .wa-set .dialog .fenster { width: min(480px, 100%); max-height: 90vh; overflow: auto; box-sizing: border-box; padding: 20px 24px 16px;
                             background: var(--card-background-color, #fff); color: var(--primary-text-color); border-radius: 16px;
                             box-shadow: 0 10px 40px rgba(0,0,0,.35); }
  .wa-set .dialog h3 { margin: 0 0 12px; font-size: 20px; font-weight: 400; }
  .wa-set .dialog .text { font-size: 14px; line-height: 1.6; color: var(--secondary-text-color); white-space: pre-line; }
  .wa-set .dialog .knoepfe { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
  .wa-set .dialog label { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 14px; color: var(--primary-text-color); }
  .wa-set .dialog .liste { margin: 4px 0 8px 28px; }
  .wa-set .toast { position: fixed; left: 50%; bottom: 24px; transform: translate(-50%, 20px); opacity: 0; pointer-events: none;
                   background: var(--primary-text-color); color: var(--card-background-color, #fff); padding: 10px 18px; border-radius: 8px;
                   font-size: 14px; transition: opacity .2s, transform .2s; z-index: 2100; }
  .wa-set .toast.an { opacity: 1; transform: translate(-50%, 0); }
  .wa-set .toast.fehler { background: var(--error-color, #db4437); color: #fff; }

  .wa-set .kat-kopf { cursor: pointer; padding-bottom: 16px; }
  .wa-set .kat:not(.zu) .kat-kopf { padding-bottom: 8px; }
  .wa-set .kat-kopf .titelblock { flex: 1 1 auto; min-width: 0; }
  .wa-set .kat-kopf .titelblock h2 { flex: none; }
  .wa-set .kat-kopf .kurz { font-size: 13px; color: var(--secondary-text-color); margin-top: 2px; display: none;
                            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .wa-set .kat.zu .kat-kopf .kurz { display: block; }
  .wa-set .kat-kopf .pfeil { flex: 0 0 auto; }
  .wa-set .banner { padding: 12px 16px; border-radius: 12px; font-size: 14px; line-height: 1.5;
                    background: rgba(var(--rgb-primary-color, 3,169,244), .14); border-left: 4px solid var(--primary-color);
                    display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .wa-set .banner.standard { background: rgba(255,152,0,.16); border-left-color: var(--warning-color, #ff9800); font-weight: 500; }
  .wa-set .banner .text { flex: 1 1 240px; }
  .wa-set .umschalter button:disabled { opacity: .45; cursor: default; }
  .wa-set .herkunft { font-size: 11px; padding: 1px 7px; border-radius: 8px; margin-left: 6px; white-space: nowrap;
                      background: var(--secondary-background-color); color: var(--secondary-text-color); }
  .wa-set .herkunft.eigen { background: rgba(var(--rgb-primary-color, 3,169,244), .14); color: var(--primary-color); }
  .wa-set .speicher { grid-column: 1 / -1; display: none; justify-content: flex-end; align-items: center; gap: 10px; }
  .wa-set .speicher.an { display: flex; }
  .wa-set .ungespeichert { font-size: 13px; color: var(--warning-color, #ff9800); font-weight: 500; }
  .wa-set .zeile.aus .steuer, .wa-set .zeile.aus .beschriftung { opacity: .45; }
  .wa-set .liste-haken { display: flex; flex-direction: column; gap: 2px; }
  .wa-set .liste-haken label { display: flex; align-items: center; gap: 10px; padding: 5px 0; font-size: 14px; cursor: pointer; }
  .wa-set .liste-haken input, .wa-set .chip input, .wa-set .person input[type="checkbox"] { width: 18px; height: 18px; margin: 0;
                                                                    accent-color: var(--primary-color); cursor: pointer; }
  .wa-set .liste-haken .klein { margin-left: 4px; }
  .wa-set .stile { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 8px; }
  .wa-set .stil { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 2px 12px; align-items: center; padding: 10px 12px;
                  border: 1px solid var(--divider-color); border-radius: 12px; cursor: pointer; }
  .wa-set .stil.gewaehlt { border-color: var(--primary-color); box-shadow: 0 0 0 1px var(--primary-color); }
  .wa-set .stil input { grid-row: 1 / span 2; width: 18px; height: 18px; margin: 0; accent-color: var(--primary-color); }
  .wa-set .stil .name { font-weight: 500; font-size: 15px; }
  .wa-set .stil .klein { grid-column: 2; }
  .wa-set .stil a { grid-row: 1 / span 2; grid-column: 3; font-size: 13px; color: var(--primary-color); text-decoration: none;
                    display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
  .wa-set .stil a:hover { text-decoration: underline; }
  .wa-set .stil a ha-icon { --mdc-icon-size: 16px; }
  .wa-set .unterpunkte { margin: 0 0 4px 30px; }
  .wa-set .unterpunkte:empty { display: none; }
  .wa-set .unterpunkte details.unter { border-top: none; }
  .wa-set .unterpunkte details.unter > summary { padding: 6px 12px; }
  .wa-set .schluesselreihe { grid-column: 1 / -1; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .wa-set .schluesselreihe .augen { flex: 1 1 220px; }
  .wa-set .zonen { grid-column: 1 / -1; display: flex; flex-direction: column; }
  .wa-set .zonenzeile { display: flex; align-items: center; gap: 10px; padding: 6px 0; flex-wrap: wrap; border-top: 1px solid var(--divider-color); }
  .wa-set .zonenzeile:first-child { border-top: none; }
  .wa-set .zonenzeile .zname { flex: 1 1 160px; display: flex; align-items: center; gap: 10px; font-size: 14px; cursor: pointer; }
  .wa-set .zonenzeile .farbwahl { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--secondary-text-color); }
  .wa-set .zonenzeile input[type="color"] { width: 40px; height: 28px; padding: 0 2px; border: 1px solid var(--divider-color); border-radius: 6px;
                                            background: none; cursor: pointer; }
  .wa-set .zonen.aus { opacity: .45; pointer-events: none; }
  .wa-set .tupfer { width: 12px; height: 12px; border-radius: 50%; flex: 0 0 auto; }
  .wa-set .person .zweite { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; margin-top: 8px; }
  .wa-set .person .zweite label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--secondary-text-color); }
  .wa-set .person .zweite select { max-width: 220px; }
  .wa-set .person .speicher { margin-top: 6px; }
  .wa-set .person.aus .bild, .wa-set .person.aus .felder, .wa-set .person.aus .zweite { opacity: .45; }
  .wa-set .person.aus .felder, .wa-set .person.aus .zweite { pointer-events: none; }
  .wa-set .chip.regel { background: rgba(var(--rgb-primary-color, 3,169,244), .12); border-color: var(--primary-color); opacity: .8; }
  .wa-set .regelhinweis { font-size: 11px; color: var(--secondary-text-color); margin-top: 4px; }
  .wa-set details.hilfe { margin: 8px 16px; border: 1px solid var(--divider-color); border-radius: 10px; padding: 0 12px; font-size: 14px; }
  .wa-set details.hilfe summary { cursor: pointer; padding: 10px 0; font-weight: 500; color: var(--primary-color); }
  .wa-set details.hilfe pre { background: var(--secondary-background-color); border-radius: 8px; padding: 10px; overflow-x: auto;
                              font-size: 12px; line-height: 1.5; white-space: pre; }
  .wa-set details.hilfe pre.prompt { white-space: pre-wrap; max-height: 260px; overflow: auto; }
  .wa-set details.hilfe p, .wa-set details.hilfe li { line-height: 1.5; color: var(--secondary-text-color); }
  .wa-set details.hilfe .reihe { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 8px 0; }
  .wa-set .rolle { font-size: 13px; padding: 5px 12px; border-radius: 14px; display: inline-flex; align-items: center; gap: 6px;
                   background: rgba(var(--rgb-primary-color, 3,169,244), .12); color: var(--primary-color); font-weight: 500; }
  .wa-set .rolle ha-icon { --mdc-icon-size: 16px; }
  .wa-set .wessen { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .wa-set .wessen select { width: auto; min-width: 240px; }
  .wa-set .erfolg { display: flex; align-items: center; gap: 10px; padding: 10px 12px 10px 14px; border-radius: 10px; font-size: 14px;
                    background: rgba(67,160,71,.14); border: 1px solid var(--success-color, #43a047); color: var(--primary-text-color); }
  .wa-set .erfolg ha-icon { color: var(--success-color, #43a047); --mdc-icon-size: 22px; }
  .wa-set .erfolg .text { flex: 1 1 auto; }
  .wa-set .erfolg button { border: none; background: none; cursor: pointer; color: var(--secondary-text-color); padding: 4px; display: inline-flex; }
  .wa-set .kat .erfolg { margin: 0 16px 12px; }
  .wa-set .gespeichert { font-size: 13px; font-weight: 500; color: var(--success-color, #43a047); }
  .wa-set .toast.ok { background: var(--success-color, #43a047); color: #fff; }
  .wa-set .feldschloss { flex: 0 0 auto; width: 30px; height: 30px; border: none; border-radius: 50%; background: none; cursor: pointer; padding: 0;
                         color: var(--secondary-text-color); display: inline-flex; align-items: center; justify-content: center; }
  .wa-set .feldschloss.an { color: var(--warning-color, #ff9800); }
  .wa-set .feldschloss ha-icon { --mdc-icon-size: 18px; }
  .wa-set .zeile.fest .steuer { opacity: .55; }
  .wa-set .zeile.blitz { animation: wa-blitz 1.6s ease-out; }
  @keyframes wa-blitz { 0%, 30% { background: rgba(255,152,0,.25); } 100% { background: transparent; } }
  .wa-set .benutzer { margin: 8px 16px 12px; border: 1px solid var(--divider-color); border-radius: 12px; overflow: hidden; }
  .wa-set .benutzer .kopf { display: flex; align-items: center; gap: 10px; padding: 10px 12px; flex-wrap: wrap;
                            background: var(--secondary-background-color); }
  .wa-set .benutzer .kopf b { flex: 1 1 auto; font-weight: 500; }
  .wa-set .benutzer select { width: auto; }
  .wa-set .benutzer select.ein { height: 40px; }
  .wa-set .benutzer table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .wa-set .benutzer th, .wa-set .benutzer td { text-align: left; padding: 8px 10px; border-top: 1px solid var(--divider-color); vertical-align: middle; }
  .wa-set .benutzer th { font-weight: 500; color: var(--secondary-text-color); font-size: 13px; }
  .wa-set .benutzer tr.alle td { background: rgba(var(--rgb-primary-color, 3,169,244), .05); font-weight: 500; }
  .wa-set .benutzer .status { font-size: 12px; padding: 2px 8px; border-radius: 8px; white-space: nowrap; display: inline-block; }
  .wa-set .benutzer .status.standard { background: var(--secondary-background-color); color: var(--secondary-text-color); }
  .wa-set .benutzer .status.eigen { background: rgba(var(--rgb-primary-color, 3,169,244), .14); color: var(--primary-color); }
  .wa-set .benutzer .status.sync { background: rgba(67,160,71,.14); color: var(--success-color, #43a047); }
  .wa-set .benutzer .status.fest { background: rgba(255,152,0,.16); color: var(--warning-color, #ef6c00); margin-left: 4px; }
  .wa-set .schalter-klein { width: 36px; height: 20px; accent-color: var(--primary-color); cursor: pointer; }
  .wa-set .kat-kopf .ganz { font-size: 12px; padding: 4px 10px; }
  .wa-set .vorschau-tabelle { max-height: 50vh; overflow: auto; margin: 8px 0; border: 1px solid var(--divider-color); border-radius: 8px; }
  .wa-set .vorschau-tabelle table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .wa-set .vorschau-tabelle th, .wa-set .vorschau-tabelle td { padding: 6px 8px; border-top: 1px solid var(--divider-color); text-align: left; }
  .wa-set .vorschau-tabelle th { position: sticky; top: 0; background: var(--card-background-color); border-top: none; font-weight: 500; }
  .wa-set .vorschau-tabelle .details td { background: var(--secondary-background-color); color: var(--secondary-text-color); font-size: 12px; }
  .wa-set .vorschau-tabelle button.auf { border: none; background: none; cursor: pointer; color: var(--primary-color); padding: 0 4px; }
  .wa-set .dialog .fenster.breit { width: min(760px, 100%); }
  .wa-set .abschnitt-kopf { display: flex; align-items: center; gap: 10px; padding: 14px 16px 4px; font-size: 16px; font-weight: 500;
                            border-top: 1px solid var(--divider-color); }
  .wa-set .abschnitt-kopf ha-icon { --mdc-icon-size: 20px; color: var(--secondary-text-color); }
  .wa-set .augen { position: relative; flex: 1 1 220px; display: flex; }
  .wa-set .augen input { flex: 1 1 auto; padding-right: 40px; }
  .wa-set .augen button { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); }
  .wa-set .verwaltet { padding: 40px 16px; text-align: center; color: var(--secondary-text-color); font-size: 15px; }
  .wa-set .verwaltet ha-icon { --mdc-icon-size: 40px; display: block; margin: 0 auto 12px; }
  .wa-set .dialog ul { margin: 8px 0; padding-left: 20px; font-size: 14px; color: var(--primary-text-color); }
  /* Every control sits centred next to its label; fields look like Home Assistant's (filled, line below, same height) */
  .wa-set .zeile { align-items: center; }
  .wa-set .steuer { align-items: center; align-self: center; }
  .wa-set .steuer.schalter { justify-content: flex-end; }
  .wa-set .steuer ha-switch { margin: 0 4px; }
  .wa-set input.ein, .wa-set select.ein, .wa-set .mehrfach > button {
    height: 56px; box-sizing: border-box; padding: 0 12px; font-size: 16px; border: none; border-radius: 4px 4px 0 0;
    border-bottom: 1px solid var(--mdc-text-field-idle-line-color, rgba(127,127,127,.6));
    background: var(--mdc-text-field-fill-color, var(--input-fill-color, rgba(127,127,127,.08))); color: var(--primary-text-color); }
  .wa-set input.ein:focus, .wa-set select.ein:focus, .wa-set .mehrfach > button:focus { outline: none; border-bottom: 2px solid var(--primary-color); }
  .wa-set input[type="color"].ein { height: 56px; padding: 8px; }
  .wa-set .bildwahl .ablage-klein { min-height: 56px; box-sizing: border-box; }
  .wa-set .person .zweite select.ein { height: 56px; }
  /* Empty placeholders (drafts, success, hints) take no room */
  .wa-set main > div:empty { display: none; }
  /* Own value: blue dot before the name, arrow back to the standard; afterwards "Restore" with a running ring */
  .wa-set .marker { display: inline-flex; align-items: center; gap: 2px; flex: 0 0 auto; }
  .wa-set .marker:empty { display: none; }
  .wa-set .punkt-eigen { width: 8px; height: 8px; border-radius: 50%; background: var(--primary-color); flex: 0 0 auto; margin: 0 2px; }
  .wa-set .zurueck-pfeil { width: 28px; height: 28px; border: none; border-radius: 50%; background: none; cursor: pointer; padding: 0;
                           color: var(--secondary-text-color); display: inline-flex; align-items: center; justify-content: center; }
  .wa-set .zurueck-pfeil:hover { color: var(--primary-color); background: rgba(var(--rgb-primary-color, 3,169,244), .1); }
  .wa-set .zurueck-pfeil ha-icon { --mdc-icon-size: 18px; }
  .wa-set .wiederherstellen { position: relative; display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px 0 4px;
                              border: none; border-radius: 14px; background: rgba(var(--rgb-primary-color, 3,169,244), .1); cursor: pointer;
                              font: inherit; font-size: 12px; font-weight: 500; color: var(--primary-color); white-space: nowrap; }
  .wa-set .wiederherstellen svg { width: 22px; height: 22px; flex: 0 0 auto; }
  .wa-set .wiederherstellen .ring-hg { fill: none; stroke: rgba(127,127,127,.25); stroke-width: 2.4; }
  .wa-set .wiederherstellen .ring { fill: none; stroke: var(--primary-color); stroke-width: 2.4; stroke-linecap: round;
                                    stroke-dasharray: 56.55; transform: rotate(-90deg); transform-origin: 11px 11px;
                                    animation: wa-ablauf 30s linear forwards; }
  .wa-set .wiederherstellen ha-icon { position: absolute; left: 7px; top: 7px; --mdc-icon-size: 14px; }
  @keyframes wa-ablauf { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 56.55; } }
  .wa-set .knopf.wiederherstellen { height: auto; padding: 7px 14px 7px 8px; border-radius: 18px; font-size: 14px; border: 1px solid var(--primary-color); }
  .wa-set .knopf.wiederherstellen ha-icon { left: 12px; top: 50%; margin-top: -7px; }
  /* Activity log: same side spacing as the rows */
  .wa-set .protokoll { padding: 0 16px; }
  /* Sub-areas that open and close (CARTO styles, zone list, accuracy, address sensors) */
  .wa-set details.unter { grid-column: 1 / -1; border-top: 1px solid var(--divider-color); }
  .wa-set details.unter > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 10px 16px; }
  .wa-set details.unter > summary::-webkit-details-marker { display: none; }
  .wa-set details.unter > summary .titel { font-size: 15px; }
  .wa-set details.unter > summary .kurz2 { font-size: 13px; color: var(--secondary-text-color); margin-left: auto; text-align: right;
                                           overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .wa-set details.unter > summary .kurz2.warn { color: var(--warning-color, #ef6c00); }
  .wa-set details.unter > summary .pfeil2 { flex: 0 0 auto; color: var(--secondary-text-color); transition: transform .2s; }
  .wa-set details.unter[open] > summary .pfeil2 { transform: rotate(180deg); }
  .wa-set details.unter[open] > summary .kurz2 { display: none; }
  .wa-set details.unter .innen { padding: 0 0 6px; }
  .wa-set details.unter .innen > .zeile:first-child { border-top: none; }
  .wa-set .zeile.innen-zeile { padding-left: 32px; }
  /* CARTO styles: 2 × 2 */
  .wa-set .stilraster { display: grid; grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr); gap: 8px 12px; align-items: center; padding: 4px 16px 12px; }
  .wa-set .stilraster .kopf { font-size: 13px; color: var(--secondary-text-color); font-weight: 500; }
  .wa-set .stilraster .zelle { display: flex; align-items: center; gap: 4px; min-width: 0; }
  .wa-set .stilraster .zelle > :first-child { flex: 1 1 auto; min-width: 0; }
  .wa-set .api { font-size: 12px; font-weight: 600; padding: 1px 7px; border-radius: 8px; margin-left: 6px; }
  .wa-set .api.ok { color: var(--success-color, #43a047); background: rgba(67,160,71,.12); }
  .wa-set .api.schlecht { color: var(--error-color, #db4437); background: rgba(219,68,55,.1); }
  /* Map apps: a field with ticks */
  .wa-set .mehrfach { position: relative; width: 100%; }
  .wa-set .mehrfach > button { width: 100%; text-align: left; display: flex; align-items: center; gap: 8px; font: inherit; font-size: 14px;
                               padding: 9px 10px; border: 1px solid var(--divider-color); border-radius: 8px; cursor: pointer;
                               background: var(--card-background-color); color: var(--primary-text-color); }
  .wa-set .mehrfach > button span { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wa-set .mehrfach > button:disabled { opacity: .5; cursor: default; }
  .wa-set .mehrfach .liste { position: absolute; z-index: 20; left: 0; right: 0; top: calc(100% + 4px); padding: 6px 0;
                             background: var(--card-background-color); border: 1px solid var(--divider-color); border-radius: 8px;
                             box-shadow: 0 4px 16px rgba(0,0,0,.2); }
  .wa-set .mehrfach .liste label { display: flex; align-items: center; gap: 10px; padding: 8px 12px; font-size: 14px; cursor: pointer; }
  .wa-set .mehrfach .liste label:hover { background: var(--secondary-background-color); }
  .wa-set .mehrfach .liste input { width: 18px; height: 18px; margin: 0; accent-color: var(--primary-color); }
  /* Contrast and similar colours: cannot be clicked away */
  .wa-set .kontrast { grid-column: 1 / -1; font-size: 13px; line-height: 1.4; padding: 6px 10px; border-radius: 8px;
                      background: rgba(255,166,0,.14); border-left: 3px solid var(--warning-color, #ffa600); }
  /* Profile picture: drop field, preview, crop */
  .wa-set .bildwahl { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
  .wa-set .bildwahl .ablage-klein { flex: 1 1 200px; display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 2px dashed var(--divider-color);
                                    border-radius: 10px; color: var(--secondary-text-color); font-size: 13px; cursor: pointer; min-width: 0; }
  .wa-set .bildwahl .ablage-klein.drueber { border-color: var(--primary-color); color: var(--primary-color); }
  .wa-set .bildwahl .ablage-klein ha-icon { --mdc-icon-size: 20px; flex: 0 0 auto; }
  .wa-set .bildwahl .vorschau { width: 40px; height: 40px; border-radius: 50%; background: center/cover no-repeat var(--secondary-background-color); flex: 0 0 auto; }
  .wa-set .bildwahl a, .wa-set .bildwahl .verweis-knopf { font-size: 13px; color: var(--primary-color); cursor: pointer; background: none; border: none; padding: 4px; font-family: inherit; }
  .wa-set .zuschnitt { position: relative; width: 280px; height: 280px; max-width: 100%; margin: 0 auto; border-radius: 12px; overflow: hidden;
                       background: #222; touch-action: none; cursor: grab; user-select: none; }
  .wa-set .zuschnitt canvas { display: block; width: 100%; height: 100%; }
  .wa-set .zuschnitt .maske { position: absolute; inset: 0; pointer-events: none;
                              background: radial-gradient(circle closest-side at center, transparent 99.5%, rgba(0,0,0,.55) 100%); }
  .wa-set .zoomzeile { display: flex; align-items: center; gap: 10px; margin: 12px auto 0; max-width: 280px; }
  .wa-set .zoomzeile input { flex: 1 1 auto; accent-color: var(--primary-color); }
  /* Users: one table */
  .wa-set .benutzer td .klein + .klein { margin-top: 2px; }
  .wa-set .benutzer .spalte-recht { min-width: 120px; }
  .wa-set .benutzer .schalterzeile { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--secondary-text-color); margin-top: 4px; white-space: nowrap; }
  .wa-set .benutzer select.ein { width: auto; padding: 6px 8px; font-size: 13px; }
  .wa-set .banner .fertig { margin-left: auto; }
  .wa-set .neue-benutzer .person-recht { margin: 6px 0 12px; padding: 8px 10px; border: 1px solid var(--divider-color); border-radius: 10px; }
  .wa-set .neue-benutzer .person-recht b { display: block; margin-bottom: 4px; }
  .wa-set .neue-benutzer .rechtzeile { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; font-size: 13px; margin: 2px 0; }
  .wa-set .neue-benutzer .rechtzeile > span { min-width: 110px; color: var(--secondary-text-color); }
  .wa-set .neue-benutzer label.chip, .wa-set .dialog .chips label.chip { padding: 2px 8px 2px 4px; }
  .wa-set .dialog input[type="date"] { font: inherit; font-size: 14px; padding: 4px 6px; border: 1px solid var(--divider-color); border-radius: 6px;
                                      background: var(--card-background-color); color: var(--primary-text-color); color-scheme: light dark; }
  @media (max-width: 870px) {
    .wa-set { display: block; padding: 0 8px 16px; }
    .wa-set .toc { display: none; }
    .wa-set main { gap: 12px; }
    .wa-set .sprung { display: block; position: sticky; top: 0; z-index: 5; padding: 8px 0; background: var(--primary-background-color); }
    .wa-set .zeile { grid-template-columns: minmax(0, 1fr); }
    .wa-set .steuer { justify-content: flex-start; }
    .wa-set .zeile.schalter-zeile { grid-template-columns: minmax(0, 1fr) auto; }
    /* Person rows: picture with the order buttons below it on the left, everything else in full width */
    .wa-set .person { grid-template-columns: 44px minmax(0, 1fr) auto; align-items: start; gap: 8px 10px; padding: 12px; }
    .wa-set .person .bild { grid-column: 1; grid-row: 1; }
    .wa-set .person .reihenfolge { grid-column: 1; grid-row: 2; flex-direction: column; align-items: center; }
    .wa-set .person .mitte { grid-column: 2; grid-row: 1 / span 2; min-width: 0; }
    .wa-set .person > .info { grid-column: 3; grid-row: 1; }
    .wa-set .person .felder { grid-template-columns: minmax(0, 1fr); }
    .wa-set .person .felder input.farbe { width: 72px; }
    .wa-set .person .zweite { grid-template-columns: minmax(0, 1fr); }
    .wa-set .person .zweite label { flex-wrap: wrap; }
    .wa-set .person .zweite select { max-width: none; flex: 1 1 160px; }
    .wa-set .kat { scroll-margin-top: 72px; }
    .wa-set .kat-text { padding-left: 16px; }
    .wa-set .stilraster { grid-template-columns: minmax(0, 1fr); }
    .wa-set .stilraster .kopf.leer, .wa-set .stilraster .kopf.spalte { display: none; }
    .wa-set .stilraster .zeilenkopf { margin-top: 6px; }
    .wa-set .zeile.innen-zeile { padding-left: 16px; }
  }
`;
