export function stopWheelIfScrollable(e) {
    const el = e.currentTarget
    const atTop = el.scrollTop <= 0
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
    const goingUp = e.deltaY < 0
    const goingDown = e.deltaY > 0
    if ((!atTop && goingUp) || (!atBottom && goingDown)) e.stopPropagation()
}