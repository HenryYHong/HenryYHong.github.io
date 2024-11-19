particlesJS("particles-js", {
  particles: {
    number: {
      value: 100 /* Increase number of particles */,
      density: {
        enable: true,
        value_area: 1000 /* Increase the area where particles are distributed */,
      },
    },
    color: {
      value: "#ffffff",
    },
    shape: {
      type: "circle",
      stroke: {
        width: 0,
        color: "#000000",
      },
    },
    opacity: {
      value: 0.5 /* Slightly increase opacity */,
      random: false,
    },
    size: {
      value: 7 /* Increase particle size */,
      random: true,
    },
    line_linked: {
      enable: true,
      distance: 150,
      color: "#ffffff",
      opacity: 0.4,
      width: 2 /* Increase line width for better visibility */,
    },
    move: {
      enable: true,
      speed: 5 /* Increase movement speed */,
      direction: "none",
      random: false,
      straight: false,
      out_mode: "out",
      bounce: false,
    },
  },
  interactivity: {
    detect_on: "canvas",
    events: {
      onhover: {
        enable: true,
        mode: "repulse",
      },
      onclick: {
        enable: true,
        mode: "push",
      },
      resize: true,
    },
    modes: {
      grab: {
        distance: 200,
        line_linked: {
          opacity: 1,
        },
      },
      bubble: {
        distance: 200,
        size: 15 /* Increase bubble size on hover */,
        duration: 2,
        opacity: 1,
      },
      repulse: {
        distance: 200,
        duration: 0.8,
      },
      push: {
        particles_nb: 4,
      },
    },
  },
  retina_detect: true,
});
