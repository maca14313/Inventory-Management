#!/bin/bash
cd /home/z/my-project
pkill -9 -f "next" 2>/dev/null; sleep 1; rm -rf .next/cache 2>/dev/null
nohup bun run dev > dev.log 2>&1 & disown
sleep 13
echo "server=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000)"
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 2
# Login
agent-browser click @e3 >/dev/null 2>&1; sleep 4
# Find Returns nav button ref
NAV=$(agent-browser snapshot -i 2>&1 | grep 'button "Returns"' | grep -oE 'ref=e[0-9]+' | head -1 | cut -d'e' -f2)
echo "Returns nav ref=e=$NAV"
agent-browser click @e$NAV >/dev/null 2>&1; sleep 4
echo "=== TABS ==="
agent-browser snapshot -i 2>&1 | grep -iE 'tab "'
echo "=== ROWS ==="
agent-browser snapshot -i 2>&1 | grep -iE 'cell "'
# Find the Return button ref on the first row
RETBTN=$(agent-browser snapshot -i 2>&1 | grep 'button "Return"' | grep -oE 'ref=e[0-9]+' | head -1 | cut -d'e' -f2)
echo "Return button ref=e=$RETBTN"
# Click Return button to open dialog
agent-browser click @e$RETBTN >/dev/null 2>&1; sleep 1
echo "=== RETURN DIALOG ==="
agent-browser snapshot -i 2>&1 | grep -iE 'Return Item|spinbutton|Return to Inventory'
# Find the qty spinbutton and the submit button
QTY=$(agent-browser snapshot -i 2>&1 | grep 'spinbutton' | grep -oE 'ref=e[0-9]+' | head -1 | cut -d'e' -f2)
SUBMIT=$(agent-browser snapshot -i 2>&1 | grep 'Return to Inventory' | grep -oE 'ref=e[0-9]+' | head -1 | cut -d'e' -f2)
echo "qty ref=e=$QTY submit ref=e=$SUBMIT"
# Change qty to 2 (partial return)
agent-browser fill @e$QTY "2" >/dev/null 2>&1; sleep 0.5
# Submit
agent-browser click @e$SUBMIT >/dev/null 2>&1; sleep 4
echo "=== AFTER RETURN (dev log errors) ==="
grep -iE "returns|REAL ERROR|500" dev.log | tail -5
echo "=== RETURNS PAGE AFTER ==="
agent-browser snapshot -i 2>&1 | grep -iE 'tab "|cell "' | head -12
