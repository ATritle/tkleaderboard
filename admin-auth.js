/* =========================================
   TK LEADERBOARD ADMIN PASSWORD PROTECTION
========================================= */

(function () {

  const PASSWORD = "twister";
  const SESSION_KEY = "tk_admin_authenticated";


  function isAuthenticated() {

    return sessionStorage.getItem(
      SESSION_KEY
    ) === "true";

  }


  function requestAccess() {

    // Already authenticated during this
    // browser session.
    if (isAuthenticated()) {
      return true;
    }


    const entered = window.prompt(
      "ADMIN PASSWORD\n\nEnter the password to access the admin page:"
    );


    if (entered === PASSWORD) {

      sessionStorage.setItem(
        SESSION_KEY,
        "true"
      );

      return true;
    }


    window.alert(
      "Incorrect password. Admin access denied."
    );

    return false;
  }


  /*
   * Protect direct visits to admin.html.
   */

  if (
    document.body &&
    document.body.dataset.adminPage === "true"
  ) {

    if (!requestAccess()) {

      window.location.replace(
        "index.html"
      );

      return;
    }
  }


  /*
   * Protect the ADMIN link on the
   * public leaderboard.
   */

  document.addEventListener(
    "click",
    function (event) {

      const link =
        event.target.closest(
          "a.admin-link"
        );


      if (!link) {
        return;
      }


      if (!requestAccess()) {

        event.preventDefault();

      }

    }
  );

})();
