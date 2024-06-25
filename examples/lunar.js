document.addEventListener('DOMContentLoaded', (event) => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    const lander = {
        x: canvas.width / 2 - 20,
        y: 50,
        width: 40,
        height: 40,
        speedX: 0,
        speedY: 0,
        gravity: 0.02,
        thrust: -0.3, // Zwiększona siła silnika
        displayThrust: false
    };

    function drawLander() {
        ctx.fillStyle = '#fff';
        ctx.fillRect(lander.x, lander.y, lander.width, lander.height);
        // Efekt wizualny dla pracy silnika
        if (lander.displayThrust) {
            ctx.fillStyle = '#f00'; // Kolor ognia
            ctx.beginPath();
            ctx.moveTo(lander.x + lander.width * 0.3, lander.y + lander.height);
            ctx.lineTo(lander.x + lander.width / 2, lander.y + lander.height + 10); // Długość płomienia
            ctx.lineTo(lander.x + lander.width * 0.7, lander.y + lander.height);
            ctx.fill();
        }
    }

    function updateGameArea() {
        lander.speedY += lander.gravity;
        lander.x += lander.speedX;
        lander.y += lander.speedY;

        // Prosta detekcja lądowania
        if (lander.y + lander.height > canvas.height) {
            lander.y = canvas.height - lander.height;
            lander.speedY = 0;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawLander();
    }

    function controlLander(e) {
        switch (e.key) {
            case 'ArrowRight':
                lander.speedX += 0.1;
                break;
            case 'ArrowLeft':
                lander.speedX -= 0.1;
                break;
            case 'ArrowUp':
                lander.speedY += lander.thrust; // Umożliwia uniesienie się
                lander.displayThrust = true;
                break;
        }
    }

    function stopHorizontalMovement() {
        lander.speedX = 0;
    }

    document.addEventListener('keydown', controlLander);
    document.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            stopHorizontalMovement();
        }
        if (e.key === 'ArrowUp') {
            lander.displayThrust = false;
        }
    });

    setInterval(updateGameArea, 20);
});
