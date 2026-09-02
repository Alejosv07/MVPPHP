
((d, w) => {

    const modal = d.querySelector("#reservation-modal");

    d.addEventListener("click", (event) => {
        console.log(event.target);
        if (event.target.matches("[btn-close]")
            || event.target.matches("[btn-edit]")) {
            modal.classList.toggle("hidden");
            modal.classList.toggle("pointer-events-none");
        }
    });
})(document, window);